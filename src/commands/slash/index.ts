/**
 * Slash Commands System
 *
 * A modular slash command system for Horus CLI, inspired by Claude Code.
 *
 * Features:
 * - Built-in commands (/help, /clear, /models, /commit, etc.)
 * - Project commands (.horus/commands/)
 * - User commands (~/.horus/commands/)
 * - Frontmatter support for metadata
 * - $ARGUMENTS substitution
 * - Namespaced commands (e.g., git:pr -> /git:pr)
 *
 * Usage:
 * ```typescript
 * import { initializeSlashCommands, executeSlashCommand, getSlashCommandSuggestions } from './commands/slash';
 *
 * // Initialize on startup
 * await initializeSlashCommands();
 *
 * // Execute a command
 * const result = await executeSlashCommand('/help', context);
 *
 * // Get suggestions for autocomplete
 * const suggestions = getSlashCommandSuggestions('/he');
 * ```
 */

// Re-export types
export type {
  SlashCommand,
  CommandContext,
  CommandResult,
  CommandFrontmatter,
  CommandScope,
  CommandSuggestion,
  LoadedCustomCommand,
} from './types.js';

// Re-export parser utilities
export {
  parseCommandInput,
  parseFrontmatter,
  substituteArguments,
  extractCommandName,
  isValidCommandName,
} from './parser.js';

// Re-export loader utilities
export {
  loadAllCustomCommands,
  loadCustomCommand,
  createCommandTemplate,
  getCommandDirectoriesStatus,
  getUserCommandsDir,
  getProjectCommandsDir,
} from './loader.js';

// Re-export registry functions
export {
  registerBuiltinCommand,
  getCommand,
  getAllCommands,
  getCommandSuggestions,
  getCommandCounts,
  isSlashCommand,
  executeCommand,
  refreshCustomCommands,
  initializeRegistry,
} from './registry.js';

// Convenience aliases
import {
  initializeRegistry,
  executeCommand,
  getCommandSuggestions,
  isSlashCommand,
} from './registry.js';

/**
 * Initialize the slash commands system
 * Call this once at application startup
 */
export async function initializeSlashCommands(cwd: string = process.cwd()): Promise<void> {
  await initializeRegistry(cwd);
}

/**
 * Execute a slash command
 * Returns the result of command execution
 */
export { executeCommand as executeSlashCommand };

/**
 * Get command suggestions for autocomplete
 */
export { getCommandSuggestions as getSlashCommandSuggestions };

/**
 * Check if input starts with a slash (potential command)
 */
export { isSlashCommand as isSlashCommandInput };
