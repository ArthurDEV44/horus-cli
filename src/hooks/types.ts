/**
 * Hook System Types
 * Phase 4: Hooks infrastructure for Horus CLI
 */

/**
 * Available hook types
 */
export type HookType = "PreEdit" | "PostEdit" | "PreCommit" | "PreSubmit";

/**
 * What to do when a hook fails
 */
export type HookFailureMode = "continue" | "block";

/**
 * Configuration for a single hook
 */
export interface HookConfig {
  /** Unique name for the hook */
  name: string;
  /** When to trigger this hook */
  type: HookType;
  /** Whether the hook is active */
  enabled: boolean;
  /** Shell command to execute */
  command: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** What to do on failure (default: 'continue') */
  failureMode?: HookFailureMode;
  /** Optional description */
  description?: string;
}

/**
 * Result of executing a hook
 */
export interface HookResult {
  /** Hook name */
  name: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Command output (stdout) */
  output?: string;
  /** Error message or stderr */
  error?: string;
  /** Execution duration in ms */
  duration: number;
  /** Whether this hook blocked the operation */
  blocked?: boolean;
}

/**
 * Context passed to hooks during execution
 */
export interface HookContext {
  /** File path (for PreEdit/PostEdit) */
  filePath?: string;
  /** File content (for PreEdit) */
  content?: string;
  /** New content after edit (for PostEdit) */
  newContent?: string;
  /** User message (for PreSubmit) */
  message?: string;
  /** Commit message (for PreCommit) */
  commitMessage?: string;
  /** Files being committed (for PreCommit) */
  stagedFiles?: string[];
}

/**
 * Root configuration file structure
 */
export interface HooksConfigFile {
  /** Version for future migrations */
  version?: number;
  /** List of hooks */
  hooks: HookConfig[];
}

/**
 * Default hook configuration values
 */
export const HOOK_DEFAULTS = {
  timeout: 30000,
  failureMode: "continue" as HookFailureMode,
  enabled: true,
};

/**
 * Hook type descriptions for UI
 */
export const HOOK_TYPE_DESCRIPTIONS: Record<HookType, string> = {
  PreEdit: "Executed before a file is modified",
  PostEdit: "Executed after a file is modified",
  PreCommit: "Executed before a git commit",
  PreSubmit: "Executed before sending a message to the AI",
};
