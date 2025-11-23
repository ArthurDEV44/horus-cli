/**
 * VerificationPipeline
 * Phase 4: Implements rules-based verification after tool actions
 *
 * Features:
 * - Lint check (fast, 2s timeout)
 * - Test runner (thorough mode, opt-in)
 * - Type checking (thorough mode)
 * - Configurable verification modes
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import fs from 'fs-extra';
import { ContextTelemetry } from '../utils/context-telemetry.js';

const execAsync = promisify(exec);

/**
 * Verification modes
 */
export type VerificationMode = 'fast' | 'thorough';

/**
 * Lint check result
 */
export interface LintResult {
  passed: boolean;
  issues: string[];
  duration: number;
}

/**
 * Test result
 */
export interface TestResult {
  passed: boolean;
  output: string;
  duration: number;
}

/**
 * Type check result
 */
export interface TypeCheckResult {
  passed: boolean;
  errors: string[];
  duration: number;
}

/**
 * Complete verification result
 */
export interface VerificationResult {
  passed: boolean;
  checks: {
    lint?: LintResult;
    tests?: TestResult;
    types?: TypeCheckResult;
  };
  duration: number;
}

/**
 * Tool result (from HorusAgent)
 */
export interface ToolResult {
  success: boolean;
  output: string;
  filePath?: string;
  operation?: 'view' | 'create' | 'str_replace' | 'replace_lines' | 'search';
}

/**
 * Verification pipeline configuration
 */
export interface VerificationConfig {
  mode: VerificationMode;
  lintEnabled: boolean;
  testsEnabled: boolean;
  typesEnabled: boolean;
  lintTimeout: number;
  testTimeout: number;
  typesTimeout: number;
}

/**
 * Default verification configuration
 */
const DEFAULT_CONFIG: VerificationConfig = {
  mode: 'fast',
  lintEnabled: true,
  testsEnabled: false, // Opt-in for tests
  typesEnabled: false, // Opt-in for types
  lintTimeout: 2000, // 2s
  testTimeout: 10000, // 10s
  typesTimeout: 5000, // 5s
};

/**
 * VerificationPipeline
 *
 * Implements gather-act-verify loop's VERIFY phase
 */
export class VerificationPipeline {
  private config: VerificationConfig;
  private telemetry: ContextTelemetry;
  private debug: boolean;

  constructor(config: Partial<VerificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.telemetry = ContextTelemetry.getInstance();
    this.debug = process.env.HORUS_CONTEXT_DEBUG === 'true';
  }

  /**
   * Verify tool result
   */
  async verify(
    action: ToolResult,
    mode?: VerificationMode
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const effectiveMode = mode || this.config.mode;

    const checks: VerificationResult['checks'] = {};

    // Skip verification for read-only operations
    if (action.operation === 'view' || action.operation === 'search') {
      if (this.debug) {
        console.error('[VerificationPipeline] Skipping verification for read-only operation');
      }
      return {
        passed: true,
        checks: {},
        duration: Date.now() - startTime,
      };
    }

    // Skip if no file path (can't verify)
    if (!action.filePath) {
      if (this.debug) {
        console.error('[VerificationPipeline] No filePath, skipping verification');
      }
      return {
        passed: true,
        checks: {},
        duration: Date.now() - startTime,
      };
    }

    // Lint check (fast mode + thorough mode)
    if (this.config.lintEnabled && this.shouldLint(action.filePath)) {
      try {
        checks.lint = await this.runLint(action.filePath);
      } catch (error) {
        if (this.debug) {
          console.error('[VerificationPipeline] Lint check failed:', error);
        }
        checks.lint = {
          passed: false,
          issues: [error instanceof Error ? error.message : String(error)],
          duration: 0,
        };
      }
    }

    // Tests (thorough mode only)
    if (effectiveMode === 'thorough' && this.config.testsEnabled) {
      const testFile = this.findRelatedTest(action.filePath);
      if (testFile) {
        try {
          checks.tests = await this.runTests([testFile]);
        } catch (error) {
          if (this.debug) {
            console.error('[VerificationPipeline] Test failed:', error);
          }
          checks.tests = {
            passed: false,
            output: error instanceof Error ? error.message : String(error),
            duration: 0,
          };
        }
      }
    }

    // Type check (thorough mode only)
    if (effectiveMode === 'thorough' && this.config.typesEnabled) {
      try {
        checks.types = await this.runTypeCheck(action.filePath);
      } catch (error) {
        if (this.debug) {
          console.error('[VerificationPipeline] Type check failed:', error);
        }
        checks.types = {
          passed: false,
          errors: [error instanceof Error ? error.message : String(error)],
          duration: 0,
        };
      }
    }

    const duration = Date.now() - startTime;
    const passed = Object.values(checks).every((c) => c.passed);

    // Record telemetry
    this.telemetry.recordMetric({
      operation: 'verification',
      timestamp: Date.now(),
      duration,
      tokensEstimated: 0, // Verification doesn't consume tokens
      filePath: action.filePath,
      strategy: effectiveMode,
    });

    return {
      passed,
      checks,
      duration,
    };
  }

  /**
   * Run lint check
   */
  private async runLint(filePath: string): Promise<LintResult> {
    const startTime = Date.now();

    try {
      // Use ESLint if available
      await execAsync(`npx eslint "${filePath}" --max-warnings 0`, {
        timeout: this.config.lintTimeout,
      });

      return {
        passed: true,
        issues: [],
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      // Parse ESLint output
      const issues = this.parseLintOutput(error.stdout || error.stderr || '');

      return {
        passed: false,
        issues,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run tests
   */
  private async runTests(testFiles: string[]): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(
        `bun test ${testFiles.map((f) => `"${f}"`).join(' ')}`,
        {
          timeout: this.config.testTimeout,
        }
      );

      const output = stdout + stderr;
      const passed = !output.includes('FAIL') && !output.includes('error');

      return {
        passed,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        passed: false,
        output: error.stdout || error.stderr || error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run type check
   */
  private async runTypeCheck(filePath: string): Promise<TypeCheckResult> {
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(
        `npx tsc --noEmit "${filePath}"`,
        {
          timeout: this.config.typesTimeout,
        }
      );

      return {
        passed: true,
        errors: [],
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      const errors = this.parseTypeErrors(error.stdout || error.stderr || '');

      return {
        passed: false,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse ESLint output
   */
  private parseLintOutput(output: string): string[] {
    const issues: string[] = [];

    // ESLint format: "  12:5  error  'foo' is not defined  no-undef"
    const lineRegex = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+)$/gm;

    let match;
    while ((match = lineRegex.exec(output)) !== null) {
      const [, line, col, severity, message] = match;
      issues.push(`Line ${line}:${col} - ${severity}: ${message}`);
    }

    // If no matches, return raw output (might be a different linter)
    if (issues.length === 0 && output.trim()) {
      issues.push(output.trim());
    }

    return issues;
  }

  /**
   * Parse TypeScript errors
   */
  private parseTypeErrors(output: string): string[] {
    const errors: string[] = [];

    // TSC format: "file.ts(12,5): error TS2304: Cannot find name 'foo'."
    const lineRegex = /^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;

    let match;
    while ((match = lineRegex.exec(output)) !== null) {
      const [, file, line, col, code, message] = match;
      errors.push(`Line ${line}:${col} - ${code}: ${message}`);
    }

    // If no matches, return raw output
    if (errors.length === 0 && output.trim()) {
      errors.push(output.trim());
    }

    return errors;
  }

  /**
   * Should lint this file?
   */
  private shouldLint(filePath: string): boolean {
    const ext = path.extname(filePath);
    const lintableExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    return lintableExtensions.includes(ext);
  }

  /**
   * Find related test file
   */
  private findRelatedTest(filePath: string): string | null {
    const dirname = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));

    // Common test patterns
    const testPatterns = [
      `${basename}.test.ts`,
      `${basename}.spec.ts`,
      `${basename}.test.tsx`,
      `${basename}.spec.tsx`,
    ];

    // Check in same directory
    for (const pattern of testPatterns) {
      const testPath = path.join(dirname, pattern);
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }

    // Check in tests/ subdirectory
    const testsDir = path.join(dirname, 'tests');
    if (fs.existsSync(testsDir)) {
      for (const pattern of testPatterns) {
        const testPath = path.join(testsDir, pattern);
        if (fs.existsSync(testPath)) {
          return testPath;
        }
      }
    }

    // Check in ../tests/ directory
    const parentTestsDir = path.join(dirname, '..', 'tests');
    if (fs.existsSync(parentTestsDir)) {
      for (const pattern of testPatterns) {
        const testPath = path.join(parentTestsDir, pattern);
        if (fs.existsSync(testPath)) {
          return testPath;
        }
      }
    }

    return null;
  }

  /**
   * Check if tests exist for a file
   */
  hasTests(filePath: string): boolean {
    return this.findRelatedTest(filePath) !== null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): VerificationConfig {
    return { ...this.config };
  }
}

/**
 * Singleton instance (optional, can also be instantiated)
 */
let instance: VerificationPipeline | null = null;

export function getVerificationPipeline(
  config?: Partial<VerificationConfig>
): VerificationPipeline {
  if (!instance || config) {
    instance = new VerificationPipeline(config);
  }
  return instance;
}
