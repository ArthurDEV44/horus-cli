/**
 * Tests for /init generator module
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateHorusMd, writeHorusMd } from '../src/init/generator.js';
import type { ScanResult } from '../src/init/types.js';

describe('init/generator', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `horus-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // generateHorusMd
  // ==========================================================================

  describe('generateHorusMd', () => {
    const baseScanResult: ScanResult = {
      projectName: 'test-project',
      version: '1.0.0',
      scripts: {},
      hasTypeScript: false,
      isESM: false,
      strictMode: false,
      existingHorusMd: null,
      keyDependencies: [],
    };

    it('should generate HORUS.md with required sections', () => {
      const content = generateHorusMd(baseScanResult);

      expect(content).toContain('# HORUS.md');
      expect(content).toContain('## Build & Dev Commands');
      expect(content).toContain('## Code Style');
      expect(content).toContain('## Architecture');
      expect(content).toContain('## Key Patterns');
    });

    it('should include install command', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        scripts: { install: 'npm install' },
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('npm install');
      expect(content).toContain('# Install dependencies');
    });

    it('should include all scripts when available', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        scripts: {
          install: 'pnpm install',
          dev: 'pnpm run dev',
          build: 'pnpm run build',
          test: 'pnpm test',
          lint: 'pnpm run lint',
        },
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('pnpm install');
      expect(content).toContain('pnpm run dev');
      expect(content).toContain('pnpm run build');
      expect(content).toContain('pnpm test');
      expect(content).toContain('pnpm run lint');
      expect(content).toContain('# Dev mode with hot reload');
      expect(content).toContain('# Build for production');
      expect(content).toContain('# Run tests');
      expect(content).toContain('# Run linter');
    });

    it('should include ESM style for ESM projects', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        isESM: true,
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('ESM imports with .js extension');
      expect(content).toContain('import { X } from "./module.js"');
    });

    it('should include CommonJS style for non-ESM projects', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        isESM: false,
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('CommonJS');
      expect(content).toContain("require('./module')");
    });

    it('should include TypeScript patterns when enabled', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        hasTypeScript: true,
        strictMode: true,
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('kebab-case.ts');
      expect(content).toContain('PascalCase');
      expect(content).toContain('TypeScript strict mode enabled');
      expect(content).toContain('Types in src/types/');
    });

    it('should include CLI architecture for ink/commander projects', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        keyDependencies: ['commander', 'ink'],
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('CLI application');
      expect(content).toContain('agent-based architecture');
    });

    it('should include React architecture for react/next projects', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        keyDependencies: ['react', 'next'],
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('React-based application');
      expect(content).toContain('src/components/');
    });

    it('should include server architecture for express/fastify projects', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        keyDependencies: ['express'],
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('Web server application');
      expect(content).toContain('src/routes/');
    });

    it('should include key dependencies in patterns section', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        keyDependencies: ['typescript', 'vitest', 'commander'],
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('Key deps: typescript, vitest, commander');
    });

    it('should include test info when test script exists', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        scripts: { test: 'bun test' },
      };

      const content = generateHorusMd(scan);

      expect(content).toContain('Tests: see tests/');
    });

    it('should generate concise output (~30 lines)', () => {
      const scan: ScanResult = {
        ...baseScanResult,
        scripts: {
          install: 'npm install',
          dev: 'npm run dev',
          build: 'npm run build',
          test: 'npm test',
          lint: 'npm run lint',
        },
        hasTypeScript: true,
        isESM: true,
        strictMode: true,
        keyDependencies: ['typescript', 'commander', 'ink'],
      };

      const content = generateHorusMd(scan);
      const lines = content.split('\n').length;

      // Should be around 25-35 lines, not 1500+
      expect(lines).toBeGreaterThan(15);
      expect(lines).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // writeHorusMd
  // ==========================================================================

  describe('writeHorusMd', () => {
    it('should write content to file', () => {
      const content = '# HORUS.md\n\nTest content';

      const result = writeHorusMd(content, testDir, 'HORUS.md');

      expect(result.created).toBe(true);
      expect(result.filePath).toBe(join(testDir, 'HORUS.md'));
      expect(existsSync(result.filePath)).toBe(true);
      expect(readFileSync(result.filePath, 'utf-8')).toBe(content);
    });

    it('should return correct line count', () => {
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

      const result = writeHorusMd(content, testDir, 'HORUS.md');

      expect(result.linesWritten).toBe(5);
    });

    it('should use custom file name', () => {
      const content = '# Custom';

      const result = writeHorusMd(content, testDir, 'CUSTOM.md');

      expect(result.filePath).toBe(join(testDir, 'CUSTOM.md'));
      expect(existsSync(join(testDir, 'CUSTOM.md'))).toBe(true);
    });

    it('should include success message', () => {
      const content = '# Test\n\nContent';

      const result = writeHorusMd(content, testDir, 'HORUS.md');

      expect(result.message).toContain('Created HORUS.md');
      expect(result.message).toContain('lines');
    });

    it('should overwrite existing file', () => {
      const oldContent = '# Old content';
      const newContent = '# New content';

      writeHorusMd(oldContent, testDir, 'HORUS.md');
      writeHorusMd(newContent, testDir, 'HORUS.md');

      const fileContent = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(fileContent).toBe(newContent);
    });
  });

  // ==========================================================================
  // End-to-end generation test
  // ==========================================================================

  describe('end-to-end', () => {
    it('should generate and write complete HORUS.md', () => {
      const scan: ScanResult = {
        projectName: 'my-cli',
        version: '1.0.0',
        scripts: {
          install: 'bun install',
          dev: 'bun run dev',
          build: 'bun run build',
          test: 'bun test',
        },
        hasTypeScript: true,
        isESM: true,
        strictMode: true,
        keyDependencies: ['commander', 'ink', 'typescript'],
        existingHorusMd: null,
      };

      // Generate
      const content = generateHorusMd(scan);

      // Write
      const result = writeHorusMd(content, testDir, 'HORUS.md');

      // Verify
      expect(result.created).toBe(true);
      expect(result.linesWritten).toBeGreaterThan(15);
      expect(result.linesWritten).toBeLessThan(50);

      const written = readFileSync(result.filePath, 'utf-8');
      expect(written).toContain('# HORUS.md');
      expect(written).toContain('bun install');
      expect(written).toContain('CLI application');
      expect(written).toContain('TypeScript strict mode');
    });
  });
});
