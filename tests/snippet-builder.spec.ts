/**
 * Tests for SnippetBuilder
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { SnippetBuilder, buildSnippet, buildSnippets } from '../src/context/snippet-builder.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('SnippetBuilder', () => {
  let testDir: string;
  let builder: SnippetBuilder;
  let testFilePath: string;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `snippet-test-${Date.now()}`);
    await fs.mkdirp(testDir);

    // Create a comprehensive test file
    testFilePath = path.join(testDir, 'test.ts');
    const testContent = `/**
 * Test file for SnippetBuilder
 */

import { Something } from './other';

export interface TestInterface {
  name: string;
  value: number;
}

export type TestType = string | number;

export class TestClass {
  constructor(private name: string) {}

  public method() {
    return this.name;
  }

  private helperMethod() {
    // Implementation details
    const x = 1;
    const y = 2;
    return x + y;
  }
}

export function testFunction(arg: string): string {
  return arg.toUpperCase();
}

export async function asyncFunction(): Promise<void> {
  await Promise.resolve();
}

const CONSTANT = 'value';

// Some implementation that should be filtered out
if (true) {
  console.log('This is implementation');
}
`;

    await fs.writeFile(testFilePath, testContent);

    builder = new SnippetBuilder(testDir);
  });

  describe('buildSnippet', () => {
    it('should extract important lines (exports, functions, classes, types)', () => {
      const snippet = builder.buildSnippet('test.ts', { maxLines: 50 });

      expect(snippet.snippet).toContain('export interface TestInterface');
      expect(snippet.snippet).toContain('export type TestType');
      expect(snippet.snippet).toContain('export class TestClass');
      expect(snippet.snippet).toContain('export function testFunction');
      expect(snippet.snippet).toContain('export async function asyncFunction');
    });

    it('should include JSDoc comments when requested', () => {
      const snippet = builder.buildSnippet('test.ts', {
        maxLines: 50,
        includeComments: true,
      });

      expect(snippet.snippet).toContain('/**');
      expect(snippet.snippet).toContain('Test file for SnippetBuilder');
    });

    it('should exclude JSDoc comments when not requested', () => {
      const snippet = builder.buildSnippet('test.ts', {
        maxLines: 50,
        includeComments: false,
      });

      expect(snippet.snippet).not.toContain('Test file for SnippetBuilder');
    });

    it('should include imports when requested', () => {
      const snippet = builder.buildSnippet('test.ts', {
        maxLines: 50,
        includeImports: true,
      });

      expect(snippet.snippet).toContain("import { Something } from './other'");
    });

    it('should exclude imports by default', () => {
      const snippet = builder.buildSnippet('test.ts', {
        maxLines: 50,
        includeImports: false,
      });

      expect(snippet.snippet).not.toContain("import { Something }");
    });

    it('should respect maxLines limit', () => {
      const snippet = builder.buildSnippet('test.ts', { maxLines: 3 });

      const lines = snippet.snippet.split('\n').filter((l) => l.trim());
      // Should include header comment (2 lines) + up to 3 important lines + omitted message
      expect(lines.length).toBeLessThan(10);
    });

    it('should include metadata', () => {
      const snippet = builder.buildSnippet('test.ts', { maxLines: 50 });

      expect(snippet.metadata).toBeDefined();
      expect(snippet.metadata.totalLines).toBeGreaterThan(0);
      expect(snippet.metadata.totalDeclarations).toBeGreaterThan(0);
      expect(snippet.metadata.tokens).toBeGreaterThan(0);
      expect(snippet.metadata.compressionRatio).toBeGreaterThan(0);
      expect(snippet.metadata.compressionRatio).toBeLessThan(1);
    });

    it('should show compression ratio improvement', () => {
      const snippet = builder.buildSnippet('test.ts', { maxLines: 10 });

      // Compression ratio should be < 0.6 (more than 40% reduction)
      expect(snippet.metadata.compressionRatio).toBeLessThan(0.6);
    });

    it('should add header and footer when truncating', () => {
      const snippet = builder.buildSnippet('test.ts', { maxLines: 3 });

      expect(snippet.snippet).toContain('test.ts');
      expect(snippet.snippet).toContain('omitted');
    });
  });

  describe('buildSnippets (batch)', () => {
    it('should build snippets for multiple files', async () => {
      // Create a second test file
      const testFile2 = path.join(testDir, 'test2.ts');
      await fs.writeFile(
        testFile2,
        `export class AnotherClass {
  method() {}
}`
      );

      const snippets = builder.buildSnippets(['test.ts', 'test2.ts'], {
        maxLines: 50,
      });

      expect(snippets.length).toBe(2);
      expect(snippets[0].filePath).toBe('test.ts');
      expect(snippets[1].filePath).toBe('test2.ts');
    });
  });

  describe('Convenience functions', () => {
    it('buildSnippet function should work', () => {
      const snippet = buildSnippet(testFilePath, { maxLines: 50 });

      expect(snippet.snippet).toBeDefined();
      expect(snippet.metadata.tokens).toBeGreaterThan(0);
    });

    it('buildSnippets function should work', () => {
      const snippets = buildSnippets([testFilePath], { maxLines: 50 });

      expect(snippets.length).toBe(1);
      expect(snippets[0].snippet).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent files gracefully', () => {
      const snippet = builder.buildSnippet('non-existent.ts');

      expect(snippet.snippet).toContain('unable to read file');
      expect(snippet.metadata.tokens).toBe(0);
      expect(snippet.metadata.totalLines).toBe(0);
    });
  });
});
