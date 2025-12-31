/**
 * Slash Command Registry
 *
 * Central registry for all slash commands (built-in and custom).
 * Handles command lookup, execution, and autocomplete.
 */

import type {
  SlashCommand,
  CommandContext,
  CommandResult,
  CommandSuggestion,
  LoadedCustomCommand,
} from './types.js';
import { loadAllCustomCommands } from './loader.js';
import { parseCommandInput, substituteArguments } from './parser.js';

// Built-in commands will be registered here
const builtinCommands: Map<string, SlashCommand> = new Map();
const customCommands: Map<string, SlashCommand> = new Map();

let lastCustomRefresh = 0;
const REFRESH_INTERVAL = 5000; // Refresh custom commands every 5 seconds

/**
 * Register a built-in command
 */
export function registerBuiltinCommand(command: SlashCommand): void {
  if (command.scope !== 'builtin') {
    throw new Error('Cannot register non-builtin command as builtin');
  }
  builtinCommands.set(command.name.toLowerCase(), command);
}

/**
 * Convert a loaded custom command to a SlashCommand
 */
function customToSlashCommand(custom: LoadedCustomCommand): SlashCommand {
  return {
    name: custom.name,
    description: custom.frontmatter.description || `Custom command: ${custom.name}`,
    scope: custom.scope,
    argumentHint: custom.frontmatter.argumentHint,
    sourcePath: custom.path,
    frontmatter: custom.frontmatter,
    promptTemplate: custom.promptTemplate,
  };
}

/**
 * Refresh custom commands from disk
 */
export async function refreshCustomCommands(
  cwd: string = process.cwd(),
  force: boolean = false
): Promise<void> {
  const now = Date.now();

  // Skip if recently refreshed (unless forced)
  if (!force && now - lastCustomRefresh < REFRESH_INTERVAL) {
    return;
  }

  const loaded = await loadAllCustomCommands(cwd);

  // Clear and reload
  customCommands.clear();
  for (const custom of loaded) {
    const slashCommand = customToSlashCommand(custom);
    customCommands.set(custom.name.toLowerCase(), slashCommand);
  }

  lastCustomRefresh = now;
}

/**
 * Get a command by name
 */
export function getCommand(name: string): SlashCommand | undefined {
  const lowerName = name.toLowerCase();

  // Built-in commands take precedence
  if (builtinCommands.has(lowerName)) {
    return builtinCommands.get(lowerName);
  }

  return customCommands.get(lowerName);
}

/**
 * Get all commands
 */
export function getAllCommands(): SlashCommand[] {
  const all = new Map<string, SlashCommand>();

  // Add custom commands first
  for (const [name, cmd] of customCommands) {
    all.set(name, cmd);
  }

  // Built-in commands override
  for (const [name, cmd] of builtinCommands) {
    all.set(name, cmd);
  }

  return Array.from(all.values());
}

/**
 * Get command suggestions for autocomplete
 */
export function getCommandSuggestions(
  input: string = ''
): CommandSuggestion[] {
  const prefix = input.startsWith('/') ? input.substring(1).toLowerCase() : '';
  const commands = getAllCommands();

  return commands
    .filter(cmd => cmd.name.toLowerCase().startsWith(prefix))
    .map(cmd => ({
      command: `/${cmd.name}`,
      description: cmd.description,
      scope: cmd.scope,
      argumentHint: cmd.argumentHint,
    }))
    .sort((a, b) => {
      // Sort by scope (builtin first), then by name
      const scopeOrder = { builtin: 0, project: 1, user: 2 };
      const scopeDiff = scopeOrder[a.scope] - scopeOrder[b.scope];
      if (scopeDiff !== 0) return scopeDiff;
      return a.command.localeCompare(b.command);
    });
}

/**
 * Check if input is a slash command
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * Execute a slash command
 */
export async function executeCommand(
  input: string,
  context: CommandContext
): Promise<CommandResult> {
  if (!isSlashCommand(input)) {
    return { handled: false };
  }

  const { command: cmdName, rawArgs, args } = parseCommandInput(input);

  if (!cmdName) {
    return { handled: false };
  }

  // Refresh custom commands if needed
  await refreshCustomCommands(context.cwd);

  const command = getCommand(cmdName);

  if (!command) {
    return {
      handled: true,
      error: `Unknown command: /${cmdName}. Type /help for available commands.`,
    };
  }

  // Update context with parsed args
  const execContext: CommandContext = {
    ...context,
    rawArgs,
    args,
  };

  // Execute built-in command
  if (command.execute) {
    try {
      return await command.execute(execContext);
    } catch (error: any) {
      return {
        handled: true,
        error: `Error executing /${cmdName}: ${error.message}`,
      };
    }
  }

  // Execute custom command (prompt template)
  if (command.promptTemplate) {
    const prompt = substituteArguments(command.promptTemplate, rawArgs, args);

    // If prompt is empty after substitution, show usage
    if (!prompt.trim()) {
      return {
        handled: true,
        message: `Usage: /${cmdName} ${command.argumentHint || '<arguments>'}`,
      };
    }

    // Return the expanded prompt to be processed as a user message
    return {
      handled: true,
      continueAsMessage: true,
      message: prompt,
    };
  }

  return {
    handled: true,
    error: `Command /${cmdName} has no execution handler.`,
  };
}

/**
 * Get command count by scope
 */
export function getCommandCounts(): {
  builtin: number;
  project: number;
  user: number;
  total: number;
} {
  let project = 0;
  let user = 0;

  for (const cmd of customCommands.values()) {
    if (cmd.scope === 'project') project++;
    if (cmd.scope === 'user') user++;
  }

  return {
    builtin: builtinCommands.size,
    project,
    user,
    total: builtinCommands.size + customCommands.size,
  };
}

/**
 * Initialize the registry with built-in commands
 * This is called when the module is imported
 */
export async function initializeRegistry(cwd: string = process.cwd()): Promise<void> {
  // Import and register built-in commands
  const { registerBuiltinCommands } = await import('./builtin/index.js');
  registerBuiltinCommands();

  // Load custom commands
  await refreshCustomCommands(cwd, true);
}
