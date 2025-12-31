/**
 * E2E tests for /init command
 * Tests the complete command flow including CLI integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

describe('horus init command (E2E)', () => {
  let testDir: string;
  const cliPath = join(process.cwd(), 'dist', 'index.js');
  // Use process.execPath to get the absolute path to bun/node running the tests
  const runner = process.execPath;

  beforeEach(() => {
    testDir = join(tmpdir(), `horus-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to run CLI command
   */
  function runCli(args: string, options: { cwd?: string; expectError?: boolean } = {}): string {
    const targetCwd = options.cwd ?? testDir;
    try {
      const result = execSync(`${runner} ${cliPath} ${args}`, {
        cwd: targetCwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1' },
      });
      return result;
    } catch (error: unknown) {
      if (options.expectError) {
        // Expected error, return combined output
        const err = error as { stdout?: string; stderr?: string };
        return (err.stdout ?? '') + (err.stderr ?? '');
      }
      // Unexpected error - rethrow with details
      const err = error as { stdout?: string; stderr?: string; message?: string };
      throw new Error(`CLI failed in ${targetCwd}: ${err.stderr || err.message}\nstdout: ${err.stdout}`);
    }
  }

  // ==========================================================================
  // Basic functionality
  // ==========================================================================

  describe('basic functionality', () => {
    it('should generate HORUS.md in empty project', () => {
      // Setup minimal project
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));

      // Run command
      runCli('init');

      // Verify
      expect(existsSync(join(testDir, 'HORUS.md'))).toBe(true);
      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('# HORUS.md');
      expect(content).toContain('## Build & Dev Commands');
    });

    it('should include build commands from package.json', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'my-app',
        version: '1.0.0',
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          test: 'vitest',
        },
      }));

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('npm run dev');
      expect(content).toContain('npm run build');
      expect(content).toContain('npm test');
    });

    it('should detect TypeScript project', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({ name: 'ts-app' }));
      writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          strict: true,
        },
      }));

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('TypeScript strict mode');
      expect(content).toContain('kebab-case.ts');
    });

    it('should detect ESM project', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'esm-app',
        type: 'module',
      }));

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('ESM imports with .js extension');
    });
  });

  // ==========================================================================
  // CLI options
  // ==========================================================================

  describe('CLI options', () => {
    it('should refuse to overwrite without --force', () => {
      writeFileSync(join(testDir, 'package.json'), '{}');
      writeFileSync(join(testDir, 'HORUS.md'), '# Existing content');

      // Command should fail (exit 1) - use expectError option
      const output = runCli('init', { expectError: true });
      expect(output).toContain('already exists');

      // File should not be overwritten
      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toBe('# Existing content');
    });

    it('should overwrite with --force', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'force-test',
        scripts: { build: 'tsc' },
      }));
      writeFileSync(join(testDir, 'HORUS.md'), '# Old content');

      runCli('init --force');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).not.toBe('# Old content');
      expect(content).toContain('# HORUS.md');
      expect(content).toContain('npm run build');
    });

    it('should use custom output file with -o', () => {
      writeFileSync(join(testDir, 'package.json'), '{}');

      runCli('init -o CUSTOM.md');

      expect(existsSync(join(testDir, 'CUSTOM.md'))).toBe(true);
      expect(existsSync(join(testDir, 'HORUS.md'))).toBe(false);
    });
  });

  // ==========================================================================
  // Package manager detection
  // ==========================================================================

  describe('package manager detection', () => {
    it('should detect bun', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'bun-app',
        scripts: { dev: 'bun run index.ts' },
      }));
      writeFileSync(join(testDir, 'bun.lockb'), '');

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('bun install');
      expect(content).toContain('bun run dev');
    });

    it('should detect pnpm', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'pnpm-app',
        scripts: { build: 'tsc' },
      }));
      writeFileSync(join(testDir, 'pnpm-lock.yaml'), '');

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('pnpm install');
      expect(content).toContain('pnpm run build');
    });

    it('should detect yarn', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'yarn-app',
        scripts: { test: 'jest' },
      }));
      writeFileSync(join(testDir, 'yarn.lock'), '');

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('yarn install');
      expect(content).toContain('yarn test');
    });
  });

  // ==========================================================================
  // Project type detection
  // ==========================================================================

  describe('project type detection', () => {
    it('should detect CLI project', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'my-cli',
        dependencies: {
          commander: '^11.0.0',
          ink: '^4.0.0',
        },
      }));

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('CLI application');
    });

    it('should detect React project', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'react-app',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      }));

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('React-based application');
    });

    it('should detect Express project', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'api-server',
        dependencies: {
          express: '^4.0.0',
        },
      }));

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('Web server application');
    });
  });

  // ==========================================================================
  // Output validation
  // ==========================================================================

  describe('output validation', () => {
    it('should generate concise output (~30 lines)', () => {
      writeFileSync(join(testDir, 'package.json'), JSON.stringify({
        name: 'full-app',
        version: '2.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc',
          test: 'vitest',
          lint: 'eslint',
        },
        dependencies: {
          typescript: '^5.0.0',
          commander: '^11.0.0',
        },
      }));
      writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { strict: true },
      }));

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      const lines = content.split('\n').length;

      // Should be around 25-35 lines, NOT 1500+
      expect(lines).toBeGreaterThan(15);
      expect(lines).toBeLessThan(50);
    });

    it('should have all required sections', () => {
      writeFileSync(join(testDir, 'package.json'), '{}');

      runCli('init');

      const content = readFileSync(join(testDir, 'HORUS.md'), 'utf-8');
      expect(content).toContain('# HORUS.md');
      expect(content).toContain('## Build & Dev Commands');
      expect(content).toContain('## Code Style');
      expect(content).toContain('## Architecture');
      expect(content).toContain('## Key Patterns');
    });
  });
});
