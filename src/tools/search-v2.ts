/**
 * SearchToolV2 - Enhanced file search with scoring strategies
 *
 * Improvements over SearchTool:
 * - Multi-pattern support: ['*.ts', '!*.spec.ts', 'src/**']
 * - Scoring strategies: recency, imports, fuzzy match
 * - Return formats: 'paths' or 'snippets'
 * - Limited results (default: 50 vs 100)
 * - Integration with ContextTelemetry
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { ContextTelemetry } from '../utils/context-telemetry.js';
import { createTokenCounter } from '../utils/token-counter.js';

// ============================================================================
// Types
// ============================================================================

export interface SearchOptions {
  patterns: string[];           // Multi-pattern: ['*.ts', '!*.spec.ts']
  exclude?: string[];            // Additional exclusions
  maxResults?: number;           // Default: 50
  scoreBy?: ScoreStrategy;       // 'modified' | 'imports' | 'fuzzy'
  returnFormat?: 'paths' | 'snippets'; // Default: 'paths'
  query?: string;                // For fuzzy scoring
  snippetLines?: number;         // Lines per snippet (default: 20)
}

export type ScoreStrategy = 'modified' | 'imports' | 'fuzzy';

export interface ScoredFile {
  path: string;
  score: number;
  reasons: string[];
  tokens?: number;    // If returnFormat = 'snippets'
  snippet?: string;   // If returnFormat = 'snippets'
}

export interface SearchResult {
  files: ScoredFile[];
  metadata: {
    totalScanned: number;
    totalMatched: number;
    strategy: ScoreStrategy | 'none';
    duration: number;
    tokensEstimated: number;
  };
}

// ============================================================================
// SearchToolV2 Class
// ============================================================================

export class SearchToolV2 {
  private telemetry: ContextTelemetry;
  private tokenCounter: ReturnType<typeof createTokenCounter>;
  private cwd: string;

  // Default exclusions (same as SearchTool)
  private readonly DEFAULT_EXCLUDE = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '*.log',
    '.horus/**',
  ];

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.telemetry = ContextTelemetry.getInstance();
    this.tokenCounter = createTokenCounter();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Search files with multi-pattern support and scoring
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      // 1. Glob files
      const files = await this.globMultiPattern(options.patterns, options.exclude);

      if (files.length === 0) {
        return this.emptyResult(startTime);
      }

      // 2. Score files
      const scored = await this.scoreFiles(files, options);

      // 3. Limit results
      const limited = scored.slice(0, options.maxResults ?? 50);

      // 4. Format results
      const formatted = await this.formatResults(limited, options);

      // 5. Calculate tokens
      const tokensEstimated = this.estimateTokens(formatted, options);

      // 6. Record telemetry
      const duration = Date.now() - startTime;
      this.recordTelemetry({
        filesScanned: files.length,
        filesMatched: formatted.length,
        duration,
        tokensEstimated,
        pattern: options.patterns.join(', '),
      });

      return {
        files: formatted,
        metadata: {
          totalScanned: files.length,
          totalMatched: formatted.length,
          strategy: options.scoreBy ?? 'none',
          duration,
          tokensEstimated,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordTelemetry({
        filesScanned: 0,
        filesMatched: 0,
        duration,
        tokensEstimated: 0,
        pattern: options.patterns.join(', '),
      });

      throw error;
    }
  }

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  /**
   * Multi-pattern search with exclusions
   *
   * Example: ['*.ts', '!*.spec.ts', 'src/**']
   */
  private async globMultiPattern(
    patterns: string[],
    additionalExclude: string[] = []
  ): Promise<string[]> {
    const ignore = [...this.DEFAULT_EXCLUDE, ...additionalExclude];

    // Separate include/exclude patterns
    const includePatterns = patterns.filter((p) => !p.startsWith('!'));
    const excludePatterns = patterns
      .filter((p) => p.startsWith('!'))
      .map((p) => p.slice(1)); // Remove '!'

    // Combine all exclusions
    const allExclude = [...ignore, ...excludePatterns];

    // Recursively find all files matching patterns
    const allFiles: Set<string> = new Set();

    // Walk directory tree
    const files = await this.walkDirectory(this.cwd, allExclude);

    // Filter files by include patterns
    for (const file of files) {
      for (const pattern of includePatterns) {
        if (this.matchPattern(file, pattern)) {
          allFiles.add(file);
          break;
        }
      }
    }

    return Array.from(allFiles);
  }

  /**
   * Recursively walk directory and collect all files
   */
  private async walkDirectory(
    dir: string,
    exclude: string[]
  ): Promise<string[]> {
    const files: string[] = [];

    const walk = (currentDir: string, relativePath: string = '') => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const relPath = relativePath
            ? path.join(relativePath, entry.name)
            : entry.name;

          // Check exclusions
          if (this.isExcluded(relPath, exclude)) {
            continue;
          }

          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            walk(fullPath, relPath);
          } else if (entry.isFile()) {
            files.push(relPath);
          }
        }
      } catch (error) {
        // Ignore errors (permission denied, etc.)
      }
    };

    walk(dir);
    return files;
  }

  /**
   * Check if path matches exclusion patterns
   */
  private isExcluded(filePath: string, exclusions: string[]): boolean {
    for (const pattern of exclusions) {
      if (this.matchPattern(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Simple pattern matching (supports * and **)
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // Normalize paths
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // Convert glob pattern to regex
    let regexPattern = normalizedPattern
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*\*/g, '§§§') // Temporary marker for **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/§§§/g, '.*'); // ** matches anything including /

    // Add anchors
    regexPattern = `^${regexPattern}$`;

    const regex = new RegExp(regexPattern);
    return regex.test(normalizedPath);
  }

  // ==========================================================================
  // Scoring Strategies
  // ==========================================================================

  /**
   * Score files based on strategy
   */
  private async scoreFiles(
    files: string[],
    options: SearchOptions
  ): Promise<ScoredFile[]> {
    if (!options.scoreBy) {
      // No scoring: all files score 1
      return files.map((f) => ({
        path: f,
        score: 1,
        reasons: [],
      }));
    }

    switch (options.scoreBy) {
      case 'modified':
        return this.scoreByRecency(files);
      case 'imports':
        return this.scoreByImportGraph(files, options.query ?? '');
      case 'fuzzy':
        return this.scoreByLevenshtein(files, options.query ?? '');
      default:
        return files.map((f) => ({ path: f, score: 1, reasons: [] }));
    }
  }

  /**
   * Score by recency (git log <7 days)
   */
  private async scoreByRecency(files: string[]): Promise<ScoredFile[]> {
    try {
      const gitLog = execSync('git log --name-only --since="7 days ago"', {
        cwd: this.cwd,
        encoding: 'utf-8',
      });

      const recentFiles = new Set(
        gitLog
          .split('\n')
          .filter((line) => line.trim() && !line.startsWith('commit'))
      );

      return files
        .map((f) => {
          const isRecent = recentFiles.has(f);
          return {
            path: f,
            score: isRecent ? 10 : 1,
            reasons: isRecent ? ['Modified <7d'] : [],
          };
        })
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      // Git not available or not a git repo
      return files.map((f) => ({ path: f, score: 1, reasons: [] }));
    }
  }

  /**
   * Score by imports (regex-based, fast)
   *
   * Files that import/reference the query term score higher.
   */
  private async scoreByImportGraph(
    files: string[],
    query: string
  ): Promise<ScoredFile[]> {
    if (!query) {
      return files.map((f) => ({ path: f, score: 1, reasons: [] }));
    }

    const queryLower = query.toLowerCase();

    // Regex patterns for imports (JS/TS)
    const importRegex = /import.*from\s+['"](.+)['"]/g;
    const requireRegex = /require\(['"](.+)['"]\)/g;

    return files
      .map((filePath) => {
        try {
          const fullPath = path.join(this.cwd, filePath);
          const content = fs.readFileSync(fullPath, 'utf-8');

          // Extract imports
          const imports = [
            ...content.matchAll(importRegex),
            ...content.matchAll(requireRegex),
          ].map((m) => m[1].toLowerCase());

          // Does it import something related to query?
          const matchesImport = imports.some((imp) => imp.includes(queryLower));

          // Does content mention query?
          const mentionsQuery = content.toLowerCase().includes(queryLower);

          let score = 1;
          const reasons: string[] = [];

          if (matchesImport) {
            score += 20;
            reasons.push('Imports related module');
          }

          if (mentionsQuery) {
            score += 10;
            reasons.push('Contains query term');
          }

          return { path: filePath, score, reasons };
        } catch (error) {
          // File not readable
          return { path: filePath, score: 1, reasons: [] };
        }
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Score by fuzzy match (Levenshtein distance on basename)
   */
  private scoreByLevenshtein(files: string[], query: string): ScoredFile[] {
    if (!query) {
      return files.map((f) => ({ path: f, score: 1, reasons: [] }));
    }

    const queryLower = query.toLowerCase();

    return files
      .map((filePath) => {
        const basename = path
          .basename(filePath, path.extname(filePath))
          .toLowerCase();

        const distance = this.levenshtein(basename, queryLower);
        const score = Math.max(0, 15 - distance);

        const reasons: string[] = [];
        if (score > 10) {
          reasons.push(`Close match (distance: ${distance})`);
        }

        return { path: filePath, score, reasons };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Levenshtein distance (edit distance)
   */
  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  // ==========================================================================
  // Formatting
  // ==========================================================================

  /**
   * Format results based on returnFormat option
   */
  private async formatResults(
    scored: ScoredFile[],
    options: SearchOptions
  ): Promise<ScoredFile[]> {
    if (options.returnFormat === 'snippets') {
      return this.addSnippets(scored, options.snippetLines ?? 20);
    }

    return scored;
  }

  /**
   * Add code snippets to results (first N lines)
   */
  private async addSnippets(
    scored: ScoredFile[],
    maxLines: number
  ): Promise<ScoredFile[]> {
    return scored.map((file) => {
      try {
        const fullPath = path.join(this.cwd, file.path);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').slice(0, maxLines);
        const snippet = lines.join('\n');

        const tokens = this.tokenCounter.countTokens(snippet);

        return {
          ...file,
          snippet,
          tokens,
        };
      } catch (error) {
        return {
          ...file,
          snippet: '(unable to read file)',
          tokens: 0,
        };
      }
    });
  }

  // ==========================================================================
  // Telemetry & Utilities
  // ==========================================================================

  /**
   * Estimate tokens for results
   */
  private estimateTokens(
    files: ScoredFile[],
    options: SearchOptions
  ): number {
    if (options.returnFormat === 'snippets') {
      return files.reduce((sum, f) => sum + (f.tokens ?? 0), 0);
    }

    // Estimate: ~50 tokens per path
    return files.length * 50;
  }

  /**
   * Record telemetry
   */
  private recordTelemetry(data: {
    filesScanned: number;
    filesMatched: number;
    duration: number;
    tokensEstimated: number;
    pattern: string;
  }) {
    this.telemetry.recordMetric({
      operation: 'search',
      filesScanned: data.filesScanned,
      filesMatched: data.filesMatched,
      tokensEstimated: data.tokensEstimated,
      duration: data.duration,
      cacheHit: false,
      strategy: 'search_v2',
      pattern: data.pattern,
      timestamp: Date.now(),
    });

    if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
      console.error(
        `[SearchV2] Scanned: ${data.filesScanned}, Matched: ${data.filesMatched}, Duration: ${data.duration}ms, Tokens: ${data.tokensEstimated}`
      );
    }
  }

  /**
   * Empty result helper
   */
  private emptyResult(startTime: number): SearchResult {
    const duration = Date.now() - startTime;

    this.recordTelemetry({
      filesScanned: 0,
      filesMatched: 0,
      duration,
      tokensEstimated: 0,
      pattern: '(empty)',
    });

    return {
      files: [],
      metadata: {
        totalScanned: 0,
        totalMatched: 0,
        strategy: 'none',
        duration,
        tokensEstimated: 0,
      },
    };
  }
}
