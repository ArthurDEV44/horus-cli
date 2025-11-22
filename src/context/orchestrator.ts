/**
 * Context Orchestrator
 *
 * Central coordinator for context gathering, management, and optimization.
 * Implements the "gather" phase of the gather-act-verify loop.
 */

import type {
  ContextRequest,
  ContextBundle,
  ContextSource,
  ContextOrchestratorConfig,
  IntentType,
  ContextStrategy,
} from '../types/context.js';
import { ContextCache, getContextCache } from './cache.js';
import { SearchTool } from '../tools/search.js';
import { createTokenCounter } from '../utils/token-counter.js';
import type { ToolResult } from '../types/index.js';
import path from 'path';
import fs from 'fs-extra';

/**
 * Context Orchestrator - MVP Implementation
 *
 * Phase 1 implementation with:
 * - Fixed agentic search strategy
 * - LRU cache integration
 * - Basic token budget management
 * - Intent detection (basic)
 */
export class ContextOrchestrator {
  private cache: ContextCache;
  private searchTool: SearchTool;
  private config: Required<ContextOrchestratorConfig>;
  private tokenCounter = createTokenCounter();
  private debug: boolean;

  constructor(config: ContextOrchestratorConfig = {}) {
    this.config = {
      cacheEnabled: config.cacheEnabled ?? true,
      defaultContextPercent: config.defaultContextPercent ?? 0.3, // 30%
      maxSources: config.maxSources ?? 10,
      minRelevanceScore: config.minRelevanceScore ?? 0,
      debug: config.debug ?? process.env.HORUS_CONTEXT_DEBUG === 'true',
    };

    this.debug = this.config.debug;
    this.cache = getContextCache({
      enableFileWatching: this.config.cacheEnabled,
      debug: this.debug,
    });
    this.searchTool = new SearchTool();

    if (this.debug) {
      console.error('[ContextOrchestrator] Initialized with config:', this.config);
    }
  }

  /**
   * Gather context based on request
   * MVP: Uses fixed agentic search strategy
   */
  async gather(request: ContextRequest): Promise<ContextBundle> {
    const startTime = Date.now();

    if (this.debug) {
      console.error('[ContextOrchestrator] Gathering context for intent:', request.intent);
      console.error('[ContextOrchestrator] Query:', request.query);
    }

    // Calculate available token budget
    const budget = this.calculateBudget(request);

    if (this.debug) {
      console.error('[ContextOrchestrator] Token budget:', budget);
    }

    // MVP: Always use agentic search strategy
    const sources = await this.agenticSearch(request.query, budget.available, request);

    // Build and return context bundle
    const bundle: ContextBundle = {
      sources,
      metadata: {
        filesScanned: 0, // Will be updated by telemetry
        filesRead: sources.length,
        tokensUsed: sources.reduce((sum, s) => sum + s.tokens, 0),
        strategy: 'agentic-search',
        duration: Date.now() - startTime,
        cacheHits: sources.filter((s) => s.metadata.fromCache).length,
        cacheMisses: sources.filter((s) => !s.metadata.fromCache).length,
        budgetExceeded: false,
        warnings: [],
      },
    };

    // Check if we exceeded budget
    if (bundle.metadata.tokensUsed > budget.available) {
      bundle.metadata.budgetExceeded = true;
      bundle.metadata.warnings?.push(
        `Token budget exceeded: ${bundle.metadata.tokensUsed} > ${budget.available}`
      );
    }

    if (this.debug) {
      console.error('[ContextOrchestrator] Gathered context:', {
        sources: bundle.sources.length,
        tokens: bundle.metadata.tokensUsed,
        duration: bundle.metadata.duration,
        cacheHits: bundle.metadata.cacheHits,
      });
    }

    return bundle;
  }

  /**
   * Calculate token budget for context
   */
  private calculateBudget(request: ContextRequest): {
    total: number;
    reserved: number;
    available: number;
  } {
    const total = request.budget.maxTokens;
    const reservedPercent = request.budget.reservedForContext ?? this.config.defaultContextPercent;
    const reserved = Math.floor(total * reservedPercent);
    const usedByHistory = request.budget.usedByHistory ?? 0;
    const available = Math.max(0, reserved - usedByHistory);

    return { total, reserved, available };
  }

  /**
   * Agentic search strategy (MVP implementation)
   *
   * 1. Extract keywords from query
   * 2. Search for files matching keywords
   * 3. Read top N files (respecting token budget)
   * 4. Use cache when possible
   */
  private async agenticSearch(
    query: string,
    tokenBudget: number,
    request: ContextRequest
  ): Promise<ContextSource[]> {
    const sources: ContextSource[] = [];
    let tokensUsed = 0;

    // Extract keywords from query
    const keywords = this.extractKeywords(query);

    if (this.debug) {
      console.error('[ContextOrchestrator] Extracted keywords:', keywords);
    }

    // If priority files are specified, start with those
    if (request.priorityFiles && request.priorityFiles.length > 0) {
      if (this.debug) {
        console.error('[ContextOrchestrator] Reading priority files:', request.priorityFiles);
      }

      for (const filePath of request.priorityFiles) {
        if (tokensUsed >= tokenBudget) {
          if (this.debug) {
            console.error('[ContextOrchestrator] Token budget exhausted');
          }
          break;
        }

        const source = await this.readFileAsSource(filePath, 'agentic-search');
        if (source) {
          sources.push(source);
          tokensUsed += source.tokens;
        }
      }
    }

    // Search for files matching keywords
    if (keywords.length > 0 && tokensUsed < tokenBudget) {
      // Filter out action verbs and keep only technical terms
      const technicalKeywords = keywords.filter(kw => {
        // Remove common action words and pronouns in French/English
        const actionWords = ['explique', 'expliquer', 'explain', 'show', 'tell', 'find', 'search',
                             'trouver', 'chercher', 'voir', 'comment', 'pourquoi', 'quoi',
                             'moi', 'me', 'toi', 'you'];
        return !actionWords.includes(kw.toLowerCase());
      });

      // Use technical keywords if available, otherwise use all keywords
      const searchKeywords = technicalKeywords.length > 0 ? technicalKeywords : keywords;
      const searchQuery = searchKeywords.join(' ');

      if (this.debug) {
        console.error('[ContextOrchestrator] Search query:', searchQuery);
      }

      try {
        const searchResult = await this.searchTool.search(searchQuery, {
          searchType: 'both', // Search both file names and content
          maxResults: this.config.maxSources,
          excludePattern: request.excludePatterns?.join(','),
        });

        if (searchResult.success && searchResult.output) {
          // Parse search results
          const fileMatches = this.parseSearchResults(searchResult.output);

          if (this.debug) {
            console.error('[ContextOrchestrator] Found files:', fileMatches.length);
          }

          // Read top files (up to budget)
          for (const filePath of fileMatches) {
            if (tokensUsed >= tokenBudget) break;
            if (sources.some((s) => s.path === filePath)) continue; // Skip duplicates

            const source = await this.readFileAsSource(filePath, 'agentic-search');
            if (source) {
              sources.push(source);
              tokensUsed += source.tokens;
            }
          }
        }
      } catch (error) {
        if (this.debug) {
          console.error('[ContextOrchestrator] Search failed:', error);
        }
      }
    }

    return sources.slice(0, this.config.maxSources);
  }

  /**
   * Read a file and convert to ContextSource
   * Uses cache when available
   */
  private async readFileAsSource(
    filePath: string,
    strategy: ContextStrategy
  ): Promise<ContextSource | null> {
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = this.cache.get(filePath);
        if (cached) {
          if (this.debug) {
            console.error(`[ContextOrchestrator] Cache hit: ${filePath}`);
          }
          return cached;
        }
      }

      // Read from disk directly (not via TextEditorTool to avoid formatting)
      const resolvedPath = path.resolve(filePath);

      if (!await fs.pathExists(resolvedPath)) {
        if (this.debug) {
          console.error(`[ContextOrchestrator] File not found: ${filePath}`);
        }
        return null;
      }

      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        if (this.debug) {
          console.error(`[ContextOrchestrator] Path is directory: ${filePath}`);
        }
        return null;
      }

      // Read raw file content
      const rawContent = await fs.readFile(resolvedPath, 'utf-8');
      const tokens = this.tokenCounter.countTokens(rawContent);

      const source: ContextSource = {
        type: 'file',
        path: filePath,
        content: rawContent,
        tokens,
        metadata: {
          strategy,
          fetchedAt: new Date(),
          fromCache: false,
        },
      };

      // Cache the source
      if (this.config.cacheEnabled) {
        this.cache.set(source);
      }

      return source;
    } catch (error) {
      if (this.debug) {
        console.error(`[ContextOrchestrator] Error reading ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * Extract keywords from query
   * Simple implementation: remove common words, split on spaces
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'can',
      'may',
      'might',
      'must',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'what',
      'which',
      'who',
      'where',
      'when',
      'why',
      'how',
      // French stop words
      'le',
      'la',
      'les',
      'un',
      'une',
      'des',
      'de',
      'du',
      'et',
      'ou',
      'mais',
      'dans',
      'sur',
      'avec',
      'pour',
      'par',
      'est',
      'sont',
      'être',
      'avoir',
      'faire',
      'je',
      'tu',
      'il',
      'elle',
      'nous',
      'vous',
      'ils',
      'elles',
      'ce',
      'cette',
      'ces',
      'quel',
      'quelle',
      'quels',
      'quelles',
      'comment',
      'pourquoi',
      'où',
      'quand',
    ]);

    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove all punctuation including hyphens
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // Return unique keywords
    return Array.from(new Set(words));
  }

  /**
   * Parse search tool output to extract file paths
   */
  private parseSearchResults(output: string): string[] {
    const lines = output.split('\n');
    const filePathsSet = new Set<string>(); // Use Set to avoid duplicates

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip header lines
      if (trimmed.startsWith('Search results for')) continue;
      if (trimmed.startsWith('Found:') && !trimmed.includes('.')) continue;

      // Try to extract file path from different formats
      // Format 1: "path/to/file.ts" (file search result)
      // Format 2: "path/to/file.ts (N matches)" (SearchTool format)
      // Format 3: "path/to/file.ts:123:content" (text search result with line number)
      // Format 4: "Found: path/to/file.ts"
      // Format 5: JSON-like: {"type":"text","file":"path/to/file.ts",...}

      // First, try to parse as JSON (SearchTool returns JSON for unified results)
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.file) {
          filePathsSet.add(parsed.file);
          continue;
        }
        if (parsed.path) {
          filePathsSet.add(parsed.path);
          continue;
        }
      } catch {
        // Not JSON, continue with other formats
      }

      // Format: "path/to/file.ts (N matches)" - remove the (N matches) part
      const matchesPattern = trimmed.match(/^([^\s(]+\.(ts|js|tsx|jsx|py|go|java|c|cpp|h|rs|rb|php|md|json|yaml|yml|toml|sh))\s*(?:\(\d+\s+matches?\))?/i);
      if (matchesPattern) {
        filePathsSet.add(matchesPattern[1]);
        continue;
      }

      // Format: "file:line:column:text" or "file:line:text" (ripgrep format)
      const ripgrepMatch = trimmed.match(/^([^:]+\.(ts|js|tsx|jsx|py|go|java|c|cpp|h|rs|rb|php|md|json|yaml|yml|toml|sh)):/i);
      if (ripgrepMatch) {
        filePathsSet.add(ripgrepMatch[1]);
        continue;
      }

      // Simple heuristic: look for file-like paths
      const pathMatch = trimmed.match(/^([^\s:]+\.(ts|js|tsx|jsx|py|go|java|c|cpp|h|rs|rb|php|md|json|yaml|yml|toml|sh))$/i);
      if (pathMatch) {
        filePathsSet.add(pathMatch[1]);
        continue;
      }

      // Fallback: if line contains a path separator and ends with extension
      if (trimmed.includes('/') && /\.(ts|js|tsx|jsx|py|go|java|c|cpp|h|rs|rb|php|md|json|yaml|yml|toml|sh)$/i.test(trimmed)) {
        // Remove everything after the extension
        const cleanPath = trimmed.replace(/\s.*$/, '');
        filePathsSet.add(cleanPath);
      }
    }

    return Array.from(filePathsSet);
  }

  /**
   * Detect intent from query (basic heuristics)
   * TODO: Improve with better NLP or patterns
   */
  detectIntent(query: string): IntentType {
    const lowerQuery = query.toLowerCase();

    // Explain
    if (
      lowerQuery.includes('explain') ||
      lowerQuery.includes('what is') ||
      lowerQuery.includes('what does') ||
      lowerQuery.includes('how does') ||
      lowerQuery.includes('describe') ||
      lowerQuery.includes('document') ||
      lowerQuery.includes('expliquer') ||
      lowerQuery.includes('explique') ||
      lowerQuery.includes("qu'est-ce") ||
      lowerQuery.includes('comment fonctionne')
    ) {
      return 'explain';
    }

    // Refactor
    if (
      lowerQuery.includes('refactor') ||
      lowerQuery.includes('restructure') ||
      lowerQuery.includes('reorganize') ||
      lowerQuery.includes('clean up') ||
      lowerQuery.includes('improve') ||
      lowerQuery.includes('refactoriser') ||
      lowerQuery.includes('restructurer') ||
      lowerQuery.includes('améliorer')
    ) {
      return 'refactor';
    }

    // Debug
    if (
      lowerQuery.includes('debug') ||
      lowerQuery.includes('fix') ||
      lowerQuery.includes('error') ||
      lowerQuery.includes('bug') ||
      lowerQuery.includes('issue') ||
      lowerQuery.includes('problem') ||
      lowerQuery.includes('failing') ||
      lowerQuery.includes('corriger') ||
      lowerQuery.includes('erreur') ||
      lowerQuery.includes('problème')
    ) {
      return 'debug';
    }

    // Implement
    if (
      lowerQuery.includes('implement') ||
      lowerQuery.includes('add') ||
      lowerQuery.includes('create') ||
      lowerQuery.includes('build') ||
      lowerQuery.includes('make') ||
      lowerQuery.includes('write') ||
      lowerQuery.includes('implémenter') ||
      lowerQuery.includes('ajouter') ||
      lowerQuery.includes('créer') ||
      lowerQuery.includes('construire')
    ) {
      return 'implement';
    }

    // Search
    if (
      lowerQuery.includes('find') ||
      lowerQuery.includes('search') ||
      lowerQuery.includes('look for') ||
      lowerQuery.includes('where is') ||
      lowerQuery.includes('locate') ||
      lowerQuery.includes('trouver') ||
      lowerQuery.includes('chercher') ||
      lowerQuery.includes('où est')
    ) {
      return 'search';
    }

    // Default
    return 'general';
  }

  /**
   * Compact chat history (structural summary)
   * Phase 1 MVP: Simple truncation, no LLM calls
   */
  async compact(history: any[]): Promise<any[]> {
    // MVP: Keep last N entries
    const MAX_HISTORY = 20;

    if (history.length <= MAX_HISTORY) {
      return history;
    }

    // Keep system message (first) + last N entries
    const systemMessages = history.filter((entry) => entry.role === 'system');
    const otherMessages = history.filter((entry) => entry.role !== 'system');
    const recentMessages = otherMessages.slice(-MAX_HISTORY);

    if (this.debug) {
      console.error(
        `[ContextOrchestrator] Compacted history: ${history.length} -> ${systemMessages.length + recentMessages.length}`
      );
    }

    return [...systemMessages, ...recentMessages];
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Dispose of orchestrator and cleanup resources
   */
  dispose() {
    this.cache.dispose();
  }
}
