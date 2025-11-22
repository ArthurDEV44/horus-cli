/**
 * Tests for ContextOrchestrator
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ContextOrchestrator } from '../src/context/orchestrator.js';
import { disposeGlobalCache } from '../src/context/cache.js';
import type { ContextRequest } from '../src/types/context.js';

describe('ContextOrchestrator', () => {
  let orchestrator: ContextOrchestrator;

  beforeEach(() => {
    orchestrator = new ContextOrchestrator({
      cacheEnabled: false, // Disable cache for predictable tests
      debug: false,
    });
  });

  afterEach(() => {
    orchestrator.dispose();
    disposeGlobalCache();
  });

  describe('Intent Detection', () => {
    it('should detect explain intent', () => {
      expect(orchestrator.detectIntent('Explain how this works')).toBe('explain');
      expect(orchestrator.detectIntent('What is the purpose of this?')).toBe('explain');
      expect(orchestrator.detectIntent('Expliquer ce fichier')).toBe('explain');
    });

    it('should detect refactor intent', () => {
      expect(orchestrator.detectIntent('Refactor this code')).toBe('refactor');
      expect(orchestrator.detectIntent('Restructure the project')).toBe('refactor');
      expect(orchestrator.detectIntent('Améliorer ce fichier')).toBe('refactor');
    });

    it('should detect debug intent', () => {
      expect(orchestrator.detectIntent('Fix this bug')).toBe('debug');
      expect(orchestrator.detectIntent('Debug the error')).toBe('debug');
      expect(orchestrator.detectIntent('Corriger cette erreur')).toBe('debug');
    });

    it('should detect implement intent', () => {
      expect(orchestrator.detectIntent('Implement a new feature')).toBe('implement');
      expect(orchestrator.detectIntent('Add authentication')).toBe('implement');
      expect(orchestrator.detectIntent('Créer une nouvelle fonction')).toBe('implement');
    });

    it('should detect search intent', () => {
      expect(orchestrator.detectIntent('Find all uses of this function')).toBe('search');
      expect(orchestrator.detectIntent('Where is the config file?')).toBe('search');
      expect(orchestrator.detectIntent('Trouver le fichier')).toBe('search');
    });

    it('should default to general intent', () => {
      expect(orchestrator.detectIntent('Hello')).toBe('general');
      expect(orchestrator.detectIntent('Random text')).toBe('general');
    });
  });

  describe('Context Compaction', () => {
    it('should keep history under max limit', async () => {
      const longHistory = Array.from({ length: 30 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
      }));

      const compacted = await orchestrator.compact(longHistory);

      // Should keep system messages + last 20
      expect(compacted.length).toBeLessThanOrEqual(20);
    });

    it('should preserve system messages during compaction', async () => {
      const history = [
        { role: 'system' as const, content: 'System prompt' },
        ...Array.from({ length: 25 }, (_, i) => ({
          role: 'user' as const,
          content: `User message ${i}`,
        })),
      ];

      const compacted = await orchestrator.compact(history);

      // Should have at least one system message
      const systemMessages = compacted.filter((m) => m.role === 'system');
      expect(systemMessages.length).toBeGreaterThan(0);
      expect(systemMessages[0].content).toBe('System prompt');
    });

    it('should not compact short history', async () => {
      const shortHistory = [
        { role: 'user' as const, content: 'Message 1' },
        { role: 'assistant' as const, content: 'Response 1' },
      ];

      const compacted = await orchestrator.compact(shortHistory);
      expect(compacted.length).toBe(shortHistory.length);
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache stats', () => {
      const stats = orchestrator.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.gets).toBeDefined();
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
      expect(stats.hitRate).toBeDefined();
    });

    it('should allow clearing cache', () => {
      // This should not throw
      orchestrator.clearCache();

      const stats = orchestrator.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should respect custom config', () => {
      const customOrchestrator = new ContextOrchestrator({
        cacheEnabled: true,
        defaultContextPercent: 0.5,
        maxSources: 5,
        minRelevanceScore: 10,
        debug: false,
      });

      // Orchestrator should be created without errors
      expect(customOrchestrator).toBeDefined();

      customOrchestrator.dispose();
    });

    it('should use defaults when no config provided', () => {
      const defaultOrchestrator = new ContextOrchestrator();

      expect(defaultOrchestrator).toBeDefined();

      defaultOrchestrator.dispose();
    });
  });

  describe('Keyword Extraction', () => {
    it('should extract meaningful keywords from English queries', () => {
      const orchestrator = new ContextOrchestrator({ debug: false });

      // Access private method through type assertion for testing
      const extractKeywords = (orchestrator as any).extractKeywords.bind(orchestrator);

      const keywords = extractKeywords('Find all authentication functions in the project');

      expect(keywords).toContain('authentication');
      expect(keywords).toContain('functions');
      expect(keywords).toContain('project');

      // Should filter out some stop words
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('in');

      orchestrator.dispose();
    });

    it('should extract meaningful keywords from French queries', () => {
      const orchestrator = new ContextOrchestrator({ debug: false });
      const extractKeywords = (orchestrator as any).extractKeywords.bind(orchestrator);

      const keywords = extractKeywords('Trouver toutes les fonctions dans le projet');

      expect(keywords).toContain('trouver');
      expect(keywords).toContain('fonctions');
      expect(keywords).toContain('projet');

      // Should filter out French stop words
      expect(keywords).not.toContain('les');
      expect(keywords).not.toContain('dans');
      expect(keywords).not.toContain('le');

      orchestrator.dispose();
    });

    it('should remove duplicates from keywords', () => {
      const orchestrator = new ContextOrchestrator({ debug: false });
      const extractKeywords = (orchestrator as any).extractKeywords.bind(orchestrator);

      const keywords = extractKeywords('search search search for files');

      // 'search' should appear only once
      const searchCount = keywords.filter((k: string) => k === 'search').length;
      expect(searchCount).toBe(1);

      orchestrator.dispose();
    });

    it('should handle empty queries', () => {
      const orchestrator = new ContextOrchestrator({ debug: false });
      const extractKeywords = (orchestrator as any).extractKeywords.bind(orchestrator);

      const keywords = extractKeywords('');
      expect(keywords.length).toBe(0);

      orchestrator.dispose();
    });
  });
});
