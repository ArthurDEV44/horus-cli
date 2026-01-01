/**
 * Slash Command Parser
 *
 * Parses custom command files (markdown with optional frontmatter)
 * and handles $ARGUMENTS substitution.
 */

import type { CommandFrontmatter } from './types.js';

/**
 * Parse YAML-like frontmatter from markdown content
 */
export function parseFrontmatter(content: string): {
  frontmatter: CommandFrontmatter;
  body: string;
} {
  const frontmatter: CommandFrontmatter = {};

  // Check if content starts with frontmatter delimiter
  if (!content.startsWith('---')) {
    return { frontmatter, body: content.trim() };
  }

  // Find closing delimiter
  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return { frontmatter, body: content.trim() };
  }

  const frontmatterBlock = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();

  // Parse YAML-like frontmatter (simple key: value format)
  const lines = frontmatterBlock.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Map known keys
    switch (key.toLowerCase().replace(/-/g, '')) {
      case 'description':
        frontmatter.description = value;
        break;
      case 'argumenthint':
      case 'argument_hint':
      case 'args':
        frontmatter.argumentHint = value;
        break;
      case 'allowedtools':
      case 'allowed_tools':
      case 'tools':
        // Parse as comma-separated or YAML array
        if (value.startsWith('[')) {
          frontmatter.allowedTools = value
            .slice(1, -1)
            .split(',')
            .map(s => s.trim().replace(/['"]/g, ''));
        } else {
          frontmatter.allowedTools = value.split(',').map(s => s.trim());
        }
        break;
      case 'model':
        frontmatter.model = value;
        break;
      case 'extendedthinking':
      case 'extended_thinking':
      case 'think':
        frontmatter.extendedThinking = value.toLowerCase() === 'true';
        break;
      case 'systemprompt':
      case 'system_prompt':
      case 'system':
        frontmatter.systemPrompt = value;
        break;
    }
  }

  return { frontmatter, body };
}

/**
 * Substitute $ARGUMENTS placeholder in prompt template
 */
export function substituteArguments(
  template: string,
  rawArgs: string,
  args: string[]
): string {
  let result = template;

  // Replace $ARGUMENTS with raw arguments string
  result = result.replace(/\$ARGUMENTS/g, rawArgs);

  // Replace $ARG1, $ARG2, etc. with specific arguments
  for (let i = 0; i < args.length; i++) {
    const placeholder = `$ARG${i + 1}`;
    result = result.replace(new RegExp(placeholder.replace('$', '\\$'), 'g'), args[i]);
  }

  // Replace any remaining $ARGn with empty string
  result = result.replace(/\$ARG\d+/g, '');

  return result.trim();
}

/**
 * Parse command input to extract command name and arguments
 */
export function parseCommandInput(input: string): {
  command: string;
  rawArgs: string;
  args: string[];
} {
  const trimmed = input.trim();

  // Must start with /
  if (!trimmed.startsWith('/')) {
    return { command: '', rawArgs: '', args: [] };
  }

  // Split on first space to get command and rest
  const spaceIndex = trimmed.indexOf(' ');

  if (spaceIndex === -1) {
    // No arguments
    return {
      command: trimmed.substring(1).toLowerCase(),
      rawArgs: '',
      args: [],
    };
  }

  const command = trimmed.substring(1, spaceIndex).toLowerCase();
  const rawArgs = trimmed.substring(spaceIndex + 1).trim();

  // Parse arguments (respecting quotes)
  const args = parseArguments(rawArgs);

  return { command, rawArgs, args };
}

/**
 * Parse arguments string respecting quotes
 */
function parseArguments(rawArgs: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of rawArgs) {

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
      quoteChar = '';
    } else if (!inQuote && char === ' ') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Extract command name from file path
 * e.g., "~/.horus/commands/my-command.md" -> "my-command"
 * e.g., ".horus/commands/git/pr.md" -> "git:pr" (namespaced)
 */
export function extractCommandName(
  filePath: string,
  baseDir: string
): string {
  // Get relative path from base commands directory
  const relativePath = filePath.replace(baseDir, '').replace(/^[/\\]/, '');

  // Remove .md extension
  const withoutExt = relativePath.replace(/\.md$/i, '');

  // Convert path separators to : for namespacing
  // e.g., "git/pr" -> "git:pr"
  const namespaced = withoutExt.replace(/[/\\]/g, ':');

  return namespaced.toLowerCase();
}

/**
 * Validate command name
 */
export function isValidCommandName(name: string): boolean {
  // Allow alphanumeric, hyphens, underscores, and colons (for namespacing)
  return /^[a-z0-9][a-z0-9-_:]*$/i.test(name);
}
