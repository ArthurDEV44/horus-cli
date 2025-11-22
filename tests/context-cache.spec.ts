/**
 * Tests for ContextCache
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ContextCache, disposeGlobalCache } from '../src/context/cache.js';
import type { ContextSource } from '../src/types/context.js';

describe('ContextCache', () => {
  let cache: ContextCache;

  beforeEach(() => {
    // Create new cache instance for each test
    cache = new ContextCache({
      maxEntries: 10,
      ttl: 1000, // 1 second for testing
      enableFileWatching: false, // Disable for unit tests
      debug: false,
    });
  });

  afterEach(() => {
    cache.dispose();
    disposeGlobalCache();
  });

  it('should store and retrieve context sources', () => {
    const source: ContextSource = {
      type: 'file',
      path: '/test/file.ts',
      content: 'console.log("test");',
      tokens: 10,
      metadata: {
        strategy: 'agentic-search',
      },
    };

    cache.set(source);
    const retrieved = cache.get('/test/file.ts');

    expect(retrieved).toBeDefined();
    expect(retrieved?.path).toBe('/test/file.ts');
    expect(retrieved?.content).toBe('console.log("test");');
    expect(retrieved?.metadata.fromCache).toBe(true);
  });

  it('should return undefined for cache misses', () => {
    const retrieved = cache.get('/nonexistent/file.ts');
    expect(retrieved).toBeUndefined();
  });

  it('should track cache hits and misses', () => {
    const source: ContextSource = {
      type: 'file',
      path: '/test/file.ts',
      content: 'test content',
      tokens: 5,
      metadata: {},
    };

    // Set source
    cache.set(source);

    // Hit
    cache.get('/test/file.ts');

    // Miss
    cache.get('/other/file.ts');

    const stats = cache.getStats();
    expect(stats.gets).toBe(2);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });

  it('should track tokens saved by cache', () => {
    const source: ContextSource = {
      type: 'file',
      path: '/test/file.ts',
      content: 'test content',
      tokens: 100,
      metadata: {},
    };

    cache.set(source);

    // First hit
    cache.get('/test/file.ts');
    let stats = cache.getStats();
    expect(stats.tokensSaved).toBe(100);

    // Second hit
    cache.get('/test/file.ts');
    stats = cache.getStats();
    expect(stats.tokensSaved).toBe(200);
  });

  it('should handle line range cache keys correctly', () => {
    const source: ContextSource = {
      type: 'snippet',
      path: '/test/file.ts',
      content: 'partial content',
      tokens: 5,
      lineRange: { start: 10, end: 20 },
      metadata: {},
    };

    cache.set(source);

    // Should find with exact line range
    const retrieved = cache.get('/test/file.ts', { start: 10, end: 20 });
    expect(retrieved).toBeDefined();
    expect(retrieved?.lineRange).toEqual({ start: 10, end: 20 });

    // Should NOT find with different line range
    const notFound = cache.get('/test/file.ts', { start: 1, end: 5 });
    expect(notFound).toBeUndefined();

    // Should NOT find without line range
    const notFoundFull = cache.get('/test/file.ts');
    expect(notFoundFull).toBeUndefined();
  });

  it('should invalidate specific files', () => {
    const source: ContextSource = {
      type: 'file',
      path: '/test/file.ts',
      content: 'test content',
      tokens: 5,
      metadata: {},
    };

    cache.set(source);
    expect(cache.has('/test/file.ts')).toBe(true);

    cache.invalidateFile('/test/file.ts');
    expect(cache.has('/test/file.ts')).toBe(false);
  });

  it('should clear all entries', () => {
    for (let i = 0; i < 5; i++) {
      const source: ContextSource = {
        type: 'file',
        path: `/test/file${i}.ts`,
        content: `content ${i}`,
        tokens: 5,
        metadata: {},
      };
      cache.set(source);
    }

    let stats = cache.getStats();
    expect(stats.size).toBe(5);

    cache.clear();
    stats = cache.getStats();
    expect(stats.size).toBe(0);
  });

  it('should reset statistics', () => {
    const source: ContextSource = {
      type: 'file',
      path: '/test/file.ts',
      content: 'test content',
      tokens: 10,
      metadata: {},
    };

    cache.set(source);
    cache.get('/test/file.ts'); // Hit
    cache.get('/other.ts'); // Miss

    let stats = cache.getStats();
    expect(stats.gets).toBe(2);

    cache.resetStats();
    stats = cache.getStats();
    expect(stats.gets).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.tokensSaved).toBe(0);
  });

  it('should return list of cached paths', () => {
    const paths = ['/test/a.ts', '/test/b.ts', '/test/c.ts'];

    for (const filePath of paths) {
      const source: ContextSource = {
        type: 'file',
        path: filePath,
        content: 'content',
        tokens: 5,
        metadata: {},
      };
      cache.set(source);
    }

    const cachedPaths = cache.getCachedPaths();
    expect(cachedPaths.length).toBe(3);
    expect(cachedPaths).toContain('/test/a.ts');
    expect(cachedPaths).toContain('/test/b.ts');
    expect(cachedPaths).toContain('/test/c.ts');
  });

  it('should respect max entries limit with LRU eviction', () => {
    const smallCache = new ContextCache({
      maxEntries: 3,
      ttl: 60000,
      enableFileWatching: false,
    });

    try {
      // Add 4 sources (exceeds limit of 3)
      for (let i = 0; i < 4; i++) {
        const source: ContextSource = {
          type: 'file',
          path: `/test/file${i}.ts`,
          content: `content ${i}`,
          tokens: 5,
          metadata: {},
        };
        smallCache.set(source);
      }

      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(3);

      // First entry should be evicted (LRU)
      const first = smallCache.get('/test/file0.ts');
      expect(first).toBeUndefined();

      // Last entries should still be present
      const last = smallCache.get('/test/file3.ts');
      expect(last).toBeDefined();
    } finally {
      smallCache.dispose();
    }
  });

  it('should register and use dependency graph', () => {
    cache.registerDependency('/test/a.ts', '/test/b.ts');

    const sourceA: ContextSource = {
      type: 'file',
      path: '/test/a.ts',
      content: 'import b',
      tokens: 5,
      metadata: {},
    };

    const sourceB: ContextSource = {
      type: 'file',
      path: '/test/b.ts',
      content: 'export const b',
      tokens: 5,
      metadata: {},
    };

    cache.set(sourceA);
    cache.set(sourceB);

    expect(cache.has('/test/a.ts')).toBe(true);
    expect(cache.has('/test/b.ts')).toBe(true);

    // Invalidating B should also invalidate A (importer)
    cache.invalidateFile('/test/b.ts');

    expect(cache.has('/test/b.ts')).toBe(false);
    expect(cache.has('/test/a.ts')).toBe(false); // Cascade invalidation
  });
});
