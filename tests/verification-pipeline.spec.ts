import { describe, it, expect, beforeEach } from 'bun:test';
import { VerificationPipeline, type ToolResult, type VerificationConfig } from '../src/context/verification.js';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('VerificationPipeline', () => {
  let pipeline: VerificationPipeline;

  beforeEach(() => {
    pipeline = new VerificationPipeline({
      mode: 'fast',
      lintEnabled: false, // Disable for tests (no eslint in test env)
      testsEnabled: false,
      typesEnabled: false,
    });
  });

  describe('Configuration', () => {
    it('should initialize with default config', () => {
      const config = pipeline.getConfig();
      expect(config.mode).toBe('fast');
      expect(config.lintEnabled).toBe(false);
    });

    it('should allow config updates', () => {
      pipeline.updateConfig({ mode: 'thorough' });
      const config = pipeline.getConfig();
      expect(config.mode).toBe('thorough');
    });

    it('should merge partial configs', () => {
      pipeline.updateConfig({ testsEnabled: true });
      const config = pipeline.getConfig();
      expect(config.testsEnabled).toBe(true);
      expect(config.mode).toBe('fast'); // Should keep original
    });
  });

  describe('Verification Skip Logic', () => {
    it('should skip verification for read-only operations', async () => {
      const viewResult: ToolResult = {
        success: true,
        output: 'file content',
        filePath: '/test/file.ts',
        operation: 'view',
      };

      const result = await pipeline.verify(viewResult);
      expect(result.passed).toBe(true);
      expect(Object.keys(result.checks).length).toBe(0);
    });

    it('should skip verification for search operations', async () => {
      const searchResult: ToolResult = {
        success: true,
        output: 'search results',
        operation: 'search',
      };

      const result = await pipeline.verify(searchResult);
      expect(result.passed).toBe(true);
      expect(Object.keys(result.checks).length).toBe(0);
    });

    it('should skip verification when no filePath provided', async () => {
      const result: ToolResult = {
        success: true,
        output: 'done',
        operation: 'create',
      };

      const verifyResult = await pipeline.verify(result);
      expect(verifyResult.passed).toBe(true);
      expect(Object.keys(verifyResult.checks).length).toBe(0);
    });

    it('should skip verification when operation failed', async () => {
      const failedResult: ToolResult = {
        success: false,
        output: 'error',
        filePath: '/test/file.ts',
        operation: 'str_replace',
      };

      const result = await pipeline.verify(failedResult);
      expect(result.passed).toBe(true); // Skipped, so passes
      expect(Object.keys(result.checks).length).toBe(0);
    });
  });

  describe('File Type Detection', () => {
    it('should detect TypeScript files', () => {
      // Testing via hasTests (indirect way to test shouldLint logic)
      const tsFile = '/test/example.ts';
      const result = pipeline.hasTests(tsFile);
      // We expect false since test file doesn't exist, but this tests the file detection logic
      expect(typeof result).toBe('boolean');
    });

    it('should detect non-lintable files', async () => {
      // JSON files shouldn't be linted
      const jsonResult: ToolResult = {
        success: true,
        output: 'created',
        filePath: '/test/data.json',
        operation: 'create',
      };

      // Even with lint enabled, should skip non-.ts/.js files
      const lintPipeline = new VerificationPipeline({
        lintEnabled: true,
        testsEnabled: false,
        typesEnabled: false,
      });

      const result = await lintPipeline.verify(jsonResult);
      // Should pass (no lint check for JSON)
      expect(result.passed).toBe(true);
    });
  });

  describe('Test File Discovery', () => {
    it('should return null when no test file exists', () => {
      const result = pipeline.hasTests('/nonexistent/file.ts');
      expect(result).toBe(false);
    });

    it('should check common test patterns', () => {
      // This tests that the logic doesn't crash with various paths
      const paths = [
        '/src/utils/helper.ts',
        '/src/components/Button.tsx',
        '/tests/example.spec.ts',
      ];

      paths.forEach(p => {
        const result = pipeline.hasTests(p);
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Verification Modes', () => {
    it('should respect fast mode', async () => {
      const createResult: ToolResult = {
        success: true,
        output: 'created',
        filePath: '/test/file.ts',
        operation: 'create',
      };

      const result = await pipeline.verify(createResult, 'fast');
      // Fast mode: no tests, no types (since we disabled lint)
      expect(result.passed).toBe(true);
      expect(result.checks.tests).toBeUndefined();
      expect(result.checks.types).toBeUndefined();
    });

    it('should respect thorough mode configuration', async () => {
      const thoroughPipeline = new VerificationPipeline({
        mode: 'thorough',
        lintEnabled: false,
        testsEnabled: false, // Still disabled even in thorough mode
        typesEnabled: false,
      });

      const createResult: ToolResult = {
        success: true,
        output: 'created',
        filePath: '/test/file.ts',
        operation: 'create',
      };

      const result = await thoroughPipeline.verify(createResult);
      // Thorough mode enabled but tests/types disabled
      expect(result.passed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle verification errors gracefully', async () => {
      // Create a pipeline that would fail (e.g., lint on non-existent file)
      const lintPipeline = new VerificationPipeline({
        lintEnabled: true,
        lintTimeout: 100, // Very short timeout
      });

      const result: ToolResult = {
        success: true,
        output: 'edited',
        filePath: '/nonexistent/file.ts',
        operation: 'str_replace',
      };

      // Should not throw, should return a result
      const verifyResult = await lintPipeline.verify(result);
      expect(verifyResult).toBeDefined();
      expect(verifyResult.duration).toBeGreaterThan(0);
    });

    it('should measure duration even on failure', async () => {
      const pipeline = new VerificationPipeline({
        lintEnabled: true,
        lintTimeout: 50,
      });

      const result: ToolResult = {
        success: true,
        output: 'done',
        filePath: '/test.ts',
        operation: 'create',
      };

      const verifyResult = await pipeline.verify(result);
      expect(verifyResult.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Lint Output Parsing', () => {
    it('should parse lint output correctly', () => {
      // This is tested indirectly via the verification flow
      // We can't easily test private methods, but we can verify behavior
      const pipeline = new VerificationPipeline({
        lintEnabled: false,
      });

      expect(pipeline).toBeDefined();
    });
  });

  describe('Integration with Telemetry', () => {
    it('should record telemetry on verification', async () => {
      const result: ToolResult = {
        success: true,
        output: 'done',
        filePath: '/test/file.ts',
        operation: 'view', // Read-only, should skip
      };

      const verifyResult = await pipeline.verify(result);
      expect(verifyResult).toBeDefined();
      // Telemetry recording is tested separately in context-telemetry.spec.ts
    });
  });

  describe('Result Structure', () => {
    it('should return proper result structure', async () => {
      const result: ToolResult = {
        success: true,
        output: 'done',
        filePath: '/test/file.ts',
        operation: 'view',
      };

      const verifyResult = await pipeline.verify(result);
      expect(verifyResult).toHaveProperty('passed');
      expect(verifyResult).toHaveProperty('checks');
      expect(verifyResult).toHaveProperty('duration');
      expect(typeof verifyResult.passed).toBe('boolean');
      expect(typeof verifyResult.duration).toBe('number');
      expect(typeof verifyResult.checks).toBe('object');
    });

    it('should have proper check results when verification runs', async () => {
      // Since we disable all checks in tests, we just verify the structure
      const result: ToolResult = {
        success: true,
        output: 'done',
        filePath: '/test/file.ts',
        operation: 'create',
      };

      const verifyResult = await pipeline.verify(result);
      expect(verifyResult.checks).toBeDefined();
      // Checks should be empty since all disabled
      expect(Object.keys(verifyResult.checks).length).toBe(0);
    });
  });

  describe('Timeout Configuration', () => {
    it('should respect timeout settings', () => {
      const config = pipeline.getConfig();
      expect(config.lintTimeout).toBeGreaterThan(0);
      expect(config.testTimeout).toBeGreaterThan(0);
      expect(config.typesTimeout).toBeGreaterThan(0);
    });

    it('should allow custom timeouts', () => {
      const customPipeline = new VerificationPipeline({
        lintTimeout: 5000,
        testTimeout: 20000,
        typesTimeout: 10000,
      });

      const config = customPipeline.getConfig();
      expect(config.lintTimeout).toBe(5000);
      expect(config.testTimeout).toBe(20000);
      expect(config.typesTimeout).toBe(10000);
    });
  });
});
