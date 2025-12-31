/**
 * Tests for /init scanner module
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  scanPackageJson,
  scanTsConfig,
  scanGitMetadata,
  scanExistingHorusMd,
  scanRepository,
} from '../src/init/scanner.js';
import type { InitConfig } from '../src/init/types.js';

describe('init/scanner', () => {
  let testDir: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `horus-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup temp directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // scanPackageJson
  // ==========================================================================

  describe('scanPackageJson', () => {
    it('should return defaults when package.json does not exist', () => {
      const result = scanPackageJson(testDir);

      expect(result.name).toBe('unknown');
      expect(result.version).toBe('0.0.0');
      expect(result.scripts).toEqual({});
      expect(result.isESM).toBe(false);
      expect(result.keyDependencies).toEqual([]);
    });

    it('should parse package.json correctly', () => {
      const pkg = {
        name: 'my-project',
        version: '1.2.3',
        type: 'module',
        scripts: {
          dev: 'vite dev',
          build: 'tsc',
          test: 'vitest',
          lint: 'eslint .',
        },
        dependencies: {
          react: '^18.0.0',
          commander: '^11.0.0',
        },
      };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));

      const result = scanPackageJson(testDir);

      expect(result.name).toBe('my-project');
      expect(result.version).toBe('1.2.3');
      expect(result.isESM).toBe(true);
      expect(result.scripts.dev).toBe('npm run dev');
      expect(result.scripts.build).toBe('npm run build');
      expect(result.scripts.test).toBe('npm test');
      expect(result.scripts.lint).toBe('npm run lint');
      expect(result.keyDependencies).toContain('react');
      expect(result.keyDependencies).toContain('commander');
    });

    it('should detect bun package manager', () => {
      const pkg = { name: 'test', scripts: { dev: 'bun dev' } };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));
      writeFileSync(join(testDir, 'bun.lockb'), '');

      const result = scanPackageJson(testDir);

      expect(result.scripts.dev).toBe('bun run dev');
    });

    it('should detect pnpm package manager', () => {
      const pkg = { name: 'test', scripts: { build: 'tsc' } };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));
      writeFileSync(join(testDir, 'pnpm-lock.yaml'), '');

      const result = scanPackageJson(testDir);

      expect(result.scripts.build).toBe('pnpm run build');
    });

    it('should detect yarn package manager', () => {
      const pkg = { name: 'test', scripts: { test: 'jest' } };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));
      writeFileSync(join(testDir, 'yarn.lock'), '');

      const result = scanPackageJson(testDir);

      expect(result.scripts.test).toBe('yarn test');
    });

    it('should detect key dependencies', () => {
      const pkg = {
        name: 'test',
        dependencies: {
          express: '^4.0.0',
          typescript: '^5.0.0',
        },
        devDependencies: {
          vitest: '^1.0.0',
          ink: '^4.0.0',
        },
      };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));

      const result = scanPackageJson(testDir);

      expect(result.keyDependencies).toContain('express');
      expect(result.keyDependencies).toContain('typescript');
      expect(result.keyDependencies).toContain('vitest');
      expect(result.keyDependencies).toContain('ink');
    });

    it('should handle malformed package.json', () => {
      writeFileSync(join(testDir, 'package.json'), 'invalid json {{{');

      const result = scanPackageJson(testDir);

      expect(result.name).toBe('unknown');
      expect(result.version).toBe('0.0.0');
    });
  });

  // ==========================================================================
  // scanTsConfig
  // ==========================================================================

  describe('scanTsConfig', () => {
    it('should return defaults when tsconfig.json does not exist', () => {
      const result = scanTsConfig(testDir);

      expect(result.hasTypeScript).toBe(false);
      expect(result.strictMode).toBe(false);
      expect(result.esTarget).toBeUndefined();
    });

    it('should parse tsconfig.json correctly', () => {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          strict: true,
        },
      };
      writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify(tsconfig));

      const result = scanTsConfig(testDir);

      expect(result.hasTypeScript).toBe(true);
      expect(result.strictMode).toBe(true);
      expect(result.esTarget).toBe('ES2022');
    });

    it('should handle tsconfig with comments', () => {
      const tsconfigWithComments = `{
        // This is a comment
        "compilerOptions": {
          "target": "ES2020",
          /* Multi-line
             comment */
          "strict": true
        }
      }`;
      writeFileSync(join(testDir, 'tsconfig.json'), tsconfigWithComments);

      const result = scanTsConfig(testDir);

      expect(result.hasTypeScript).toBe(true);
      expect(result.strictMode).toBe(true);
      expect(result.esTarget).toBe('ES2020');
    });

    it('should handle malformed tsconfig.json', () => {
      writeFileSync(join(testDir, 'tsconfig.json'), 'not valid json');

      const result = scanTsConfig(testDir);

      // File exists so hasTypeScript is true, but parsing failed
      expect(result.hasTypeScript).toBe(true);
      expect(result.strictMode).toBe(false);
    });

    it('should handle empty tsconfig', () => {
      writeFileSync(join(testDir, 'tsconfig.json'), '{}');

      const result = scanTsConfig(testDir);

      expect(result.hasTypeScript).toBe(true);
      expect(result.strictMode).toBe(false);
      expect(result.esTarget).toBeUndefined();
    });
  });

  // ==========================================================================
  // scanGitMetadata
  // ==========================================================================

  describe('scanGitMetadata', () => {
    it('should return empty object when not a git repo', () => {
      const result = scanGitMetadata(testDir);

      expect(result.gitBranch).toBeUndefined();
      expect(result.gitRemote).toBeUndefined();
    });

    // Note: Testing actual git operations would require creating a real git repo
    // which is beyond unit testing scope. Integration tests would cover this.
  });

  // ==========================================================================
  // scanExistingHorusMd
  // ==========================================================================

  describe('scanExistingHorusMd', () => {
    it('should return null when file does not exist', () => {
      const result = scanExistingHorusMd(testDir, 'HORUS.md');

      expect(result).toBeNull();
    });

    it('should return content when file exists', () => {
      const content = '# HORUS.md\n\nSome content here';
      writeFileSync(join(testDir, 'HORUS.md'), content);

      const result = scanExistingHorusMd(testDir, 'HORUS.md');

      expect(result).toBe(content);
    });

    it('should handle custom target file names', () => {
      const content = '# Custom file';
      writeFileSync(join(testDir, 'CUSTOM.md'), content);

      const result = scanExistingHorusMd(testDir, 'CUSTOM.md');

      expect(result).toBe(content);
    });
  });

  // ==========================================================================
  // scanRepository (integration)
  // ==========================================================================

  describe('scanRepository', () => {
    it('should aggregate all scan results', () => {
      // Setup a complete project structure
      const pkg = {
        name: 'test-project',
        version: '2.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc',
          test: 'vitest',
        },
        dependencies: {
          react: '^18.0.0',
        },
      };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));

      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          strict: true,
        },
      };
      writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify(tsconfig));

      const config: InitConfig = {
        targetFile: 'HORUS.md',
        force: false,
        includeGit: false,
        verbose: false,
        cwd: testDir,
      };

      const result = scanRepository(config);

      expect(result.projectName).toBe('test-project');
      expect(result.version).toBe('2.0.0');
      expect(result.isESM).toBe(true);
      expect(result.hasTypeScript).toBe(true);
      expect(result.strictMode).toBe(true);
      expect(result.esTarget).toBe('ES2022');
      expect(result.scripts.install).toBe('npm install');
      expect(result.scripts.dev).toBe('npm run dev');
      expect(result.keyDependencies).toContain('react');
      expect(result.existingHorusMd).toBeNull();
    });

    it('should detect existing HORUS.md', () => {
      writeFileSync(join(testDir, 'package.json'), '{}');
      writeFileSync(join(testDir, 'HORUS.md'), '# Existing content');

      const config: InitConfig = {
        targetFile: 'HORUS.md',
        force: false,
        includeGit: false,
        verbose: false,
        cwd: testDir,
      };

      const result = scanRepository(config);

      expect(result.existingHorusMd).toBe('# Existing content');
    });

    it('should work with minimal project', () => {
      // No package.json, no tsconfig
      const config: InitConfig = {
        targetFile: 'HORUS.md',
        force: false,
        includeGit: false,
        verbose: false,
        cwd: testDir,
      };

      const result = scanRepository(config);

      expect(result.projectName).toBe('unknown');
      expect(result.hasTypeScript).toBe(false);
      expect(result.isESM).toBe(false);
      expect(result.scripts.install).toBe('npm install');
    });
  });
});
