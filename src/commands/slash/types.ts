/**
 * Slash Commands Type Definitions
 *
 * Inspired by Claude Code's slash command system.
 * Supports both built-in and custom user-defined commands.
 */

import type { HorusAgent, ChatEntry } from '../../agent/horus-agent.js';

/**
 * Command scope - where the command is defined
 */
export type CommandScope = 'builtin' | 'project' | 'user';

/**
 * Command execution context
 */
export interface CommandContext {
  /** The Horus agent instance */
  agent: HorusAgent;
  /** Current chat history */
  chatHistory: ChatEntry[];
  /** Function to add entry to chat */
  addChatEntry: (entry: ChatEntry) => void;
  /** Function to clear chat history */
  clearHistory: () => void;
  /** Function to set processing state */
  setProcessing: (processing: boolean) => void;
  /** Function to set streaming state */
  setStreaming: (streaming: boolean) => void;
  /** Current working directory */
  cwd: string;
  /** Raw arguments string passed to command */
  rawArgs: string;
  /** Parsed arguments array */
  args: string[];
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Whether the command was handled */
  handled: boolean;
  /** Optional message to display */
  message?: string;
  /** Whether to continue processing as user message */
  continueAsMessage?: boolean;
  /** Optional error */
  error?: string;
}

/**
 * Frontmatter metadata for custom commands
 */
export interface CommandFrontmatter {
  /** Short description of the command */
  description?: string;
  /** Hint for arguments (e.g., "<file> [options]") */
  argumentHint?: string;
  /** List of allowed tools for this command */
  allowedTools?: string[];
  /** Model to use for this command */
  model?: string;
  /** Whether to enable extended thinking */
  extendedThinking?: boolean;
  /** Custom system prompt additions */
  systemPrompt?: string;
}

/**
 * Slash command definition
 */
export interface SlashCommand {
  /** Command name (without leading slash) */
  name: string;
  /** Short description */
  description: string;
  /** Where the command is defined */
  scope: CommandScope;
  /** Optional argument hint */
  argumentHint?: string;
  /** Source file path (for custom commands) */
  sourcePath?: string;
  /** Frontmatter metadata (for custom commands) */
  frontmatter?: CommandFrontmatter;
  /** Execute function (for built-in commands) */
  execute?: (context: CommandContext) => Promise<CommandResult>;
  /** Prompt template (for custom commands) */
  promptTemplate?: string;
}

/**
 * Loaded custom command from markdown file
 */
export interface LoadedCustomCommand {
  /** Command name derived from filename */
  name: string;
  /** Full path to the command file */
  path: string;
  /** Parsed frontmatter */
  frontmatter: CommandFrontmatter;
  /** Prompt template (markdown content after frontmatter) */
  promptTemplate: string;
  /** Scope (project or user) */
  scope: 'project' | 'user';
}

/**
 * Command registry state
 */
export interface CommandRegistryState {
  /** All registered commands */
  commands: Map<string, SlashCommand>;
  /** Built-in command names */
  builtinNames: Set<string>;
  /** Project command names */
  projectNames: Set<string>;
  /** User command names */
  userNames: Set<string>;
  /** Last refresh timestamp */
  lastRefresh: number;
}

/**
 * Command suggestion for autocomplete
 */
export interface CommandSuggestion {
  /** Full command with slash */
  command: string;
  /** Description */
  description: string;
  /** Scope indicator */
  scope: CommandScope;
  /** Argument hint if any */
  argumentHint?: string;
}
