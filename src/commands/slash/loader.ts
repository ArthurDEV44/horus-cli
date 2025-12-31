/**
 * Slash Command Loader
 *
 * Loads custom commands from:
 * - Project commands: .horus/commands/
 * - User commands: ~/.horus/commands/
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { LoadedCustomCommand, CommandScope } from './types.js';
import { parseFrontmatter, extractCommandName, isValidCommandName } from './parser.js';

/**
 * Get the user commands directory path
 */
export function getUserCommandsDir(): string {
  return path.join(os.homedir(), '.horus', 'commands');
}

/**
 * Get the project commands directory path
 */
export function getProjectCommandsDir(cwd: string = process.cwd()): string {
  return path.join(cwd, '.horus', 'commands');
}

/**
 * Recursively find all markdown files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  if (!await fs.pathExists(dir)) {
    return files;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively search subdirectories (for namespacing)
      const subFiles = await findMarkdownFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Load a single custom command from a markdown file
 */
async function loadCommandFile(
  filePath: string,
  baseDir: string,
  scope: 'project' | 'user'
): Promise<LoadedCustomCommand | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    // Extract command name from file path
    const name = extractCommandName(filePath, baseDir);

    if (!isValidCommandName(name)) {
      console.warn(`[SlashLoader] Invalid command name: ${name} (from ${filePath})`);
      return null;
    }

    return {
      name,
      path: filePath,
      frontmatter,
      promptTemplate: body,
      scope,
    };
  } catch (error) {
    console.warn(`[SlashLoader] Failed to load command from ${filePath}:`, error);
    return null;
  }
}

/**
 * Load all custom commands from a directory
 */
async function loadCommandsFromDir(
  dir: string,
  scope: 'project' | 'user'
): Promise<LoadedCustomCommand[]> {
  const commands: LoadedCustomCommand[] = [];

  try {
    const files = await findMarkdownFiles(dir);

    for (const file of files) {
      const command = await loadCommandFile(file, dir, scope);
      if (command) {
        commands.push(command);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - that's OK
    if (process.env.HORUS_DEBUG === 'true') {
      console.error(`[SlashLoader] Error loading commands from ${dir}:`, error);
    }
  }

  return commands;
}

/**
 * Load all custom commands (project + user)
 */
export async function loadAllCustomCommands(
  cwd: string = process.cwd()
): Promise<LoadedCustomCommand[]> {
  const projectDir = getProjectCommandsDir(cwd);
  const userDir = getUserCommandsDir();

  // Load in parallel
  const [projectCommands, userCommands] = await Promise.all([
    loadCommandsFromDir(projectDir, 'project'),
    loadCommandsFromDir(userDir, 'user'),
  ]);

  // Project commands take precedence over user commands with same name
  const commandMap = new Map<string, LoadedCustomCommand>();

  // Add user commands first
  for (const cmd of userCommands) {
    commandMap.set(cmd.name, cmd);
  }

  // Override with project commands
  for (const cmd of projectCommands) {
    commandMap.set(cmd.name, cmd);
  }

  return Array.from(commandMap.values());
}

/**
 * Load a specific custom command by name
 */
export async function loadCustomCommand(
  name: string,
  cwd: string = process.cwd()
): Promise<LoadedCustomCommand | null> {
  const projectDir = getProjectCommandsDir(cwd);
  const userDir = getUserCommandsDir();

  // Convert namespaced name back to path
  const relativePath = name.replace(/:/g, path.sep) + '.md';

  // Check project first (takes precedence)
  const projectPath = path.join(projectDir, relativePath);
  if (await fs.pathExists(projectPath)) {
    return loadCommandFile(projectPath, projectDir, 'project');
  }

  // Check user commands
  const userPath = path.join(userDir, relativePath);
  if (await fs.pathExists(userPath)) {
    return loadCommandFile(userPath, userDir, 'user');
  }

  return null;
}

/**
 * Create a template custom command file
 */
export async function createCommandTemplate(
  name: string,
  scope: 'project' | 'user',
  cwd: string = process.cwd()
): Promise<string> {
  const dir = scope === 'project'
    ? getProjectCommandsDir(cwd)
    : getUserCommandsDir();

  // Convert namespaced name to path
  const relativePath = name.replace(/:/g, path.sep) + '.md';
  const fullPath = path.join(dir, relativePath);

  // Ensure directory exists
  await fs.ensureDir(path.dirname(fullPath));

  // Create template content
  const template = `---
description: "Description of your command"
argument-hint: "<arg1> [arg2]"
# allowed-tools: [bash, view_file, search]
# model: devstral:24b
# extended-thinking: false
---

# ${name} Command

Your prompt template goes here.

Use $ARGUMENTS to inject all arguments passed to the command.
Use $ARG1, $ARG2, etc. for specific positional arguments.

Example usage:
\`\`\`
/${name} $ARGUMENTS
\`\`\`
`;

  await fs.writeFile(fullPath, template, 'utf-8');

  return fullPath;
}

/**
 * Check if custom commands directories exist
 */
export async function getCommandDirectoriesStatus(
  cwd: string = process.cwd()
): Promise<{
  projectDir: string;
  projectExists: boolean;
  projectCommandCount: number;
  userDir: string;
  userExists: boolean;
  userCommandCount: number;
}> {
  const projectDir = getProjectCommandsDir(cwd);
  const userDir = getUserCommandsDir();

  const [projectExists, userExists] = await Promise.all([
    fs.pathExists(projectDir),
    fs.pathExists(userDir),
  ]);

  let projectCommandCount = 0;
  let userCommandCount = 0;

  if (projectExists) {
    const files = await findMarkdownFiles(projectDir);
    projectCommandCount = files.length;
  }

  if (userExists) {
    const files = await findMarkdownFiles(userDir);
    userCommandCount = files.length;
  }

  return {
    projectDir,
    projectExists,
    projectCommandCount,
    userDir,
    userExists,
    userCommandCount,
  };
}
