/**
 * Context System Type Definitions
 *
 * Types for the context orchestration system that manages how context
 * is gathered, cached, and provided to the LLM.
 */

import type { ChatEntry } from "../agent/horus-agent.js";

/**
 * Intent types for context gathering strategy selection
 */
export type IntentType =
  | 'explain'      // Understand/document code
  | 'refactor'     // Modify structure without changing behavior
  | 'debug'        // Find and fix issues
  | 'implement'    // Add new functionality
  | 'search'       // Find specific code/files
  | 'general';     // General purpose

/**
 * Strategy used to gather context
 */
export type ContextStrategy =
  | 'agentic-search'  // Incremental grep/view operations
  | 'cached'          // Retrieved from cache
  | 'subagent'        // Delegated to isolated subagent
  | 'manual';         // Manually specified sources

/**
 * Type of context source
 */
export type ContextSourceType =
  | 'file'           // Full file content
  | 'snippet'        // Compressed/partial file content
  | 'search-result'; // Search result with context

/**
 * A single source of context (file, snippet, or search result)
 */
export interface ContextSource {
  /** Type of this source */
  type: ContextSourceType;

  /** File path (relative or absolute) */
  path: string;

  /** Content from this source */
  content: string;

  /** Estimated token count */
  tokens: number;

  /** Line range if partial file (snippet) */
  lineRange?: { start: number; end: number };

  /** Additional metadata */
  metadata: {
    /** How this source was selected */
    strategy?: ContextStrategy;

    /** Relevance score (higher = more relevant) */
    score?: number;

    /** Human-readable reasons for selection */
    reasons?: string[];

    /** Timestamp when fetched */
    fetchedAt?: Date;

    /** Whether this came from cache */
    fromCache?: boolean;

    /** Any other metadata */
    [key: string]: any;
  };
}

/**
 * Token budget configuration
 */
export interface TokenBudget {
  /** Maximum tokens allowed from model config */
  maxTokens: number;

  /** Percentage reserved for context (0-1, e.g., 0.3 = 30%) */
  reservedForContext: number;

  /** Tokens already used by chat history */
  usedByHistory?: number;

  /** Tokens available for new context */
  available?: number;
}

/**
 * Request for context gathering
 */
export interface ContextRequest {
  /** Detected intent type */
  intent: IntentType;

  /** Original user query/prompt */
  query: string;

  /** Current chat history */
  currentContext: ChatEntry[];

  /** Token budget constraints */
  budget: TokenBudget;

  /** Optional: specific files to prioritize */
  priorityFiles?: string[];

  /** Optional: patterns to exclude */
  excludePatterns?: string[];
}

/**
 * Metadata about context gathering operation
 */
export interface ContextMetadata {
  /** Number of files scanned during search */
  filesScanned: number;

  /** Number of files actually read/included */
  filesRead: number;

  /** Total tokens used by context sources */
  tokensUsed: number;

  /** Strategy that was used */
  strategy: ContextStrategy;

  /** Time taken in milliseconds */
  duration: number;

  /** Number of cache hits */
  cacheHits?: number;

  /** Number of cache misses */
  cacheMisses?: number;

  /** Whether budget was exceeded */
  budgetExceeded?: boolean;

  /** Any warnings or issues */
  warnings?: string[];

  /** Results from subagent execution (Phase 3) */
  subagentResults?: {
    total: number;
    successful: number;
    failed: number;
    filesModified: number;
  };
}

/**
 * Bundle of context sources with metadata
 */
export interface ContextBundle {
  /** Selected context sources */
  sources: ContextSource[];

  /** Metadata about the gathering operation */
  metadata: ContextMetadata;

  /** Optional: summary of what was gathered */
  summary?: string;
}

/**
 * Configuration for context orchestrator
 */
export interface ContextOrchestratorConfig {
  /** Enable/disable caching */
  cacheEnabled?: boolean;

  /** Default percentage of context budget to use (0-1) */
  defaultContextPercent?: number;

  /** Maximum number of sources to include */
  maxSources?: number;

  /** Minimum relevance score to include source (0-100) */
  minRelevanceScore?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Cache entry for context sources
 */
export interface CacheEntry {
  /** The cached source */
  source: ContextSource;

  /** When this was cached */
  cachedAt: Date;

  /** Time-to-live in milliseconds */
  ttl: number;

  /** Number of times accessed */
  hits: number;
}

/**
 * Subtask request for subagent
 */
export interface SubtaskRequest {
  /** Files this subagent should work on */
  files: string[];

  /** Instruction/task for the subagent */
  instruction: string;

  /** Tools allowed for this subagent (whitelist) */
  tools: string[];

  /** Maximum context tokens for subagent */
  maxContextTokens?: number;
}

/**
 * Result from subagent execution
 */
export interface SubagentResult {
  /** Concise summary of what was done (<500 tokens) */
  summary: string;

  /** List of files that were modified */
  changes: string[];

  /** Time taken in milliseconds */
  duration: number;

  /** Whether the task succeeded */
  success: boolean;

  /** Any errors encountered */
  error?: string;
}

/**
 * Scored file result for search operations
 */
export interface ScoredFile {
  /** File path */
  path: string;

  /** Relevance score (higher = more relevant) */
  score: number;

  /** Human-readable reasons for the score */
  reasons: string[];

  /** Estimated tokens if included */
  estimatedTokens?: number;
}
