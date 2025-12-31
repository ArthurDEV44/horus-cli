/**
 * Context Cache
 *
 * LRU cache with TTL and file system watching for context sources.
 * Automatically invalidates cached entries when files are modified.
 */

import { LRUCache } from 'lru-cache';
import chokidar, { type FSWatcher } from 'chokidar';
import type { CacheEntry, ContextSource } from '../types/context.js';
import path from 'path';

/**
 * Configuration for ContextCache
 */
export interface ContextCacheConfig {
  /** Maximum number of entries */
  maxEntries?: number;

  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;

  /** Enable file watching for auto-invalidation */
  enableFileWatching?: boolean;

  /** Directories to watch (default: current working directory) */
  watchPaths?: string[];

  /** Patterns to ignore when watching */
  ignorePatterns?: string[];

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Statistics about cache usage
 */
export interface CacheStats {
  /** Total number of get operations */
  gets: number;

  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Hit rate (0-1) */
  hitRate: number;

  /** Current number of entries */
  size: number;

  /** Maximum capacity */
  maxSize: number;

  /** Total tokens saved by cache */
  tokensSaved: number;
}

/**
 * Context cache with LRU eviction and file watching
 */
export class ContextCache {
  private cache: LRUCache<string, CacheEntry>;
  private watcher: FSWatcher | null = null;
  private stats = {
    gets: 0,
    hits: 0,
    misses: 0,
    tokensSaved: 0,
  };
  private config: Required<ContextCacheConfig>;
  private dependencyGraph = new Map<string, Set<string>>(); // file -> importers

  constructor(config: ContextCacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 100,
      ttl: config.ttl ?? 5 * 60 * 1000, // 5 minutes default
      enableFileWatching: config.enableFileWatching ?? true,
      watchPaths: config.watchPaths ?? [process.cwd()],
      ignorePatterns: config.ignorePatterns ?? [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.horus/**',
      ],
      debug: config.debug ?? process.env.HORUS_CONTEXT_DEBUG === 'true',
    };

    // Initialize LRU cache
    this.cache = new LRUCache({
      max: this.config.maxEntries,
      ttl: this.config.ttl,
      updateAgeOnGet: true,
      dispose: (value, key) => {
        if (this.config.debug) {
          console.error(`[ContextCache] Evicted: ${key}`);
        }
      },
    });

    // Initialize file watcher if enabled
    if (this.config.enableFileWatching) {
      this.initializeWatcher();
    }

    if (this.config.debug) {
      console.error(
        `[ContextCache] Initialized (max: ${this.config.maxEntries}, ttl: ${this.config.ttl}ms)`
      );
    }
  }

  /**
   * Initialize file system watcher
   */
  private initializeWatcher(): void {
    try {
      this.watcher = chokidar.watch(this.config.watchPaths, {
        ignored: this.config.ignorePatterns,
        ignoreInitial: true,
        persistent: false, // Don't keep process running
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      this.watcher.on('change', (filePath: string) => {
        this.invalidateFile(filePath);
      });

      this.watcher.on('unlink', (filePath: string) => {
        this.invalidateFile(filePath);
      });

      if (this.config.debug) {
        this.watcher.on('ready', () => {
          console.error('[ContextCache] File watcher ready');
        });
      }
    } catch (error) {
      console.error('[ContextCache] Failed to initialize file watcher:', error);
      this.watcher = null;
    }
  }

  /**
   * Generate cache key for a file path and optional line range
   */
  private generateKey(filePath: string, lineRange?: { start: number; end: number }): string {
    const normalizedPath = path.normalize(filePath);
    if (lineRange) {
      return `${normalizedPath}:${lineRange.start}-${lineRange.end}`;
    }
    return normalizedPath;
  }

  /**
   * Get a context source from cache
   */
  get(filePath: string, lineRange?: { start: number; end: number }): ContextSource | undefined {
    this.stats.gets++;
    const key = this.generateKey(filePath, lineRange);
    const entry = this.cache.get(key);

    if (entry) {
      this.stats.hits++;
      this.stats.tokensSaved += entry.source.tokens;
      entry.hits++;
      entry.source.metadata.fromCache = true;

      if (this.config.debug) {
        console.error(`[ContextCache] HIT: ${key} (hits: ${entry.hits})`);
      }

      return entry.source;
    }

    this.stats.misses++;

    if (this.config.debug) {
      console.error(`[ContextCache] MISS: ${key}`);
    }

    return undefined;
  }

  /**
   * Set a context source in cache
   */
  set(source: ContextSource, ttl?: number): void {
    const key = this.generateKey(source.path, source.lineRange);
    const entry: CacheEntry = {
      source: {
        ...source,
        metadata: {
          ...source.metadata,
          fromCache: false,
        },
      },
      cachedAt: new Date(),
      ttl: ttl ?? this.config.ttl,
      hits: 0,
    };

    this.cache.set(key, entry, { ttl: entry.ttl });

    if (this.config.debug) {
      console.error(`[ContextCache] SET: ${key} (${source.tokens} tokens)`);
    }
  }

  /**
   * Invalidate a specific file from cache
   */
  invalidateFile(filePath: string): void {
    const normalizedPath = path.normalize(filePath);
    let invalidatedCount = 0;

    // Invalidate all entries for this file (including line ranges)
    for (const key of this.cache.keys()) {
      if (key.startsWith(normalizedPath)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    // Cascade invalidation to importers
    const importers = this.dependencyGraph.get(normalizedPath);
    if (importers) {
      for (const importer of importers) {
        this.invalidateFile(importer);
      }
    }

    if (this.config.debug && invalidatedCount > 0) {
      console.error(`[ContextCache] Invalidated ${invalidatedCount} entries for: ${filePath}`);
    }
  }

  /**
   * Register dependency relationship (for cascade invalidation)
   * @param filePath - The file that imports
   * @param importedPath - The file being imported
   */
  registerDependency(filePath: string, importedPath: string): void {
    const normalizedImported = path.normalize(importedPath);
    const normalizedFile = path.normalize(filePath);

    if (!this.dependencyGraph.has(normalizedImported)) {
      this.dependencyGraph.set(normalizedImported, new Set());
    }

    this.dependencyGraph.get(normalizedImported)?.add(normalizedFile);

    if (this.config.debug) {
      console.error(`[ContextCache] Registered dependency: ${filePath} -> ${importedPath}`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.dependencyGraph.clear();

    if (this.config.debug) {
      console.error(`[ContextCache] Cleared ${size} entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      gets: this.stats.gets,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.gets > 0 ? this.stats.hits / this.stats.gets : 0,
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      tokensSaved: this.stats.tokensSaved,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      gets: 0,
      hits: 0,
      misses: 0,
      tokensSaved: 0,
    };

    if (this.config.debug) {
      console.error('[ContextCache] Stats reset');
    }
  }

  /**
   * Check if cache has a specific entry
   */
  has(filePath: string, lineRange?: { start: number; end: number }): boolean {
    const key = this.generateKey(filePath, lineRange);
    return this.cache.has(key);
  }

  /**
   * Get all cached file paths
   */
  getCachedPaths(): string[] {
    const paths = new Set<string>();
    for (const key of this.cache.keys()) {
      // Extract file path (before line range if present)
      const filePath = key.split(':')[0];
      paths.add(filePath);
    }
    return Array.from(paths);
  }

  /**
   * Dispose of the cache and cleanup resources
   */
  dispose(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.cache.clear();
    this.dependencyGraph.clear();

    if (this.config.debug) {
      console.error('[ContextCache] Disposed');
    }
  }
}

/**
 * Singleton instance for global cache
 */
let globalCache: ContextCache | null = null;

/**
 * Get or create global context cache instance
 */
export function getContextCache(config?: ContextCacheConfig): ContextCache {
  if (!globalCache) {
    globalCache = new ContextCache(config);
  }
  return globalCache;
}

/**
 * Dispose of global cache (useful for testing)
 */
export function disposeGlobalCache(): void {
  if (globalCache) {
    globalCache.dispose();
    globalCache = null;
  }
}
