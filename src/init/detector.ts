/**
 * Detector module for /init command
 * Detects frameworks, architecture patterns, and coding conventions
 */

import type {
  ScanResult,
  DetectionResult,
  FrameworkType,
  ArchitectureType,
  ProjectConventions,
  TestFrameworkType,
  BuildToolType,
} from "./types.js";

// ============================================================================
// Framework Detection
// ============================================================================

/**
 * Detects frameworks used in the project
 * @param scan Scan result containing dependencies and file structure
 * @returns Array of detected frameworks
 */
export function detectFrameworks(scan: ScanResult): FrameworkType[] {
  // TODO: Implement in Phase 3
  // Frontend:
  // - React: hasDependency('react')
  // - Next.js: hasDependency('next')
  // - Vue: hasDependency('vue')
  // - Svelte: hasDependency('svelte')
  // - Angular: hasDependency('@angular/core')
  //
  // Backend:
  // - Express: hasDependency('express')
  // - Fastify: hasDependency('fastify')
  // - NestJS: hasDependency('@nestjs/core')
  // - Koa: hasDependency('koa')
  //
  // CLI:
  // - Commander: hasDependency('commander')
  // - Yargs: hasDependency('yargs')
  // - Ink: hasDependency('ink')
  // - Oclif: hasDependency('@oclif/core')
  throw new Error("detectFrameworks not yet implemented");
}

// ============================================================================
// Architecture Detection
// ============================================================================

/**
 * Detects architectural pattern used in the project
 * @param scan Scan result containing directory structure
 * @returns Detected architecture pattern, or null if not recognized
 */
export function detectArchitecture(scan: ScanResult): ArchitectureType | null {
  // TODO: Implement in Phase 3
  // MVC: directories ['models', 'views', 'controllers']
  // Clean Architecture: ['domain', 'application', 'infrastructure']
  // Hexagonal: ['domain', 'adapters', 'ports']
  // Agent-based: ['agent', 'tools', 'context'] (Horus-specific)
  // Microservices: 'services/**' + multiple package.json
  // Monorepo: 'pnpm-workspace.yaml' or 'lerna.json' or 'nx.json'
  // Layered: ['presentation', 'business', 'data']
  throw new Error("detectArchitecture not yet implemented");
}

// ============================================================================
// Conventions Detection
// ============================================================================

/**
 * Detects coding conventions from tsconfig and file patterns
 * @param scan Scan result containing tsconfig and file structure
 * @returns Detected project conventions
 */
export function detectConventions(scan: ScanResult): ProjectConventions {
  // TODO: Implement in Phase 3
  // Module system: from package.json type or tsconfig.json module
  // Target: from tsconfig.json target
  // Strict: from tsconfig.json strict
  // Path aliases: from tsconfig.json paths
  // File naming: analyze file names (kebab-case, camelCase, PascalCase)
  // Import extensions: analyze import statements (.js, .ts, none)
  throw new Error("detectConventions not yet implemented");
}

// ============================================================================
// Test Framework Detection
// ============================================================================

/**
 * Detects test framework used in the project
 * @param scan Scan result containing dependencies and files
 * @returns Detected test framework, or null if none found
 */
export function detectTestFramework(
  scan: ScanResult
): TestFrameworkType | null {
  // TODO: Implement in Phase 3
  // Jest: hasDependency('jest') || hasFile('jest.config.*')
  // Vitest: hasDependency('vitest')
  // Bun: hasFile('bunfig.toml') || hasScript('bun test')
  // Mocha: hasDependency('mocha')
  // Ava: hasDependency('ava')
  throw new Error("detectTestFramework not yet implemented");
}

// ============================================================================
// Build Tool Detection
// ============================================================================

/**
 * Detects build tool used in the project
 * @param scan Scan result containing dependencies and scripts
 * @returns Detected build tool, or null if none found
 */
export function detectBuildTool(scan: ScanResult): BuildToolType | null {
  // TODO: Implement in Phase 3
  // From package.json scripts (build, compile):
  // - webpack: contains 'webpack'
  // - vite: contains 'vite'
  // - rollup: contains 'rollup'
  // - esbuild: contains 'esbuild'
  // - turbopack: contains 'turbopack'
  // - tsc: contains 'tsc' (default TypeScript)
  //
  // From dependencies:
  // - hasDependency('webpack')
  // - hasDependency('vite')
  // - etc.
  throw new Error("detectBuildTool not yet implemented");
}

// ============================================================================
// Main Detection Orchestrator
// ============================================================================

/**
 * Orchestrates all detection operations
 * @param scan Complete scan result
 * @returns All detection results
 */
export function detectAll(scan: ScanResult): DetectionResult {
  // TODO: Implement orchestration in Phase 3
  // Call all detection functions and aggregate results

  const frameworks = detectFrameworks(scan);
  const architecture = detectArchitecture(scan);
  const conventions = detectConventions(scan);
  const testFramework = detectTestFramework(scan);
  const buildTool = detectBuildTool(scan);

  return {
    frameworks,
    architecture,
    conventions,
    testFramework,
    buildTool,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a dependency exists in package.json
 * @param scan Scan result
 * @param depName Dependency name
 * @returns True if dependency exists in deps or devDeps
 */
function hasDependency(scan: ScanResult, depName: string): boolean {
  const deps = scan.package.dependencies || {};
  const devDeps = scan.package.devDependencies || {};
  return depName in deps || depName in devDeps;
}

/**
 * Check if a file pattern exists in the project
 * @param scan Scan result
 * @param pattern File pattern (glob or exact match)
 * @returns True if file exists
 */
function hasFile(scan: ScanResult, pattern: string): boolean {
  // TODO: Implement file pattern checking
  // Use fast-glob or check against structure.tree
  return false;
}

/**
 * Check if directories exist in the project
 * @param scan Scan result
 * @param dirs Array of directory names
 * @returns True if all directories exist
 */
function hasDirectories(scan: ScanResult, dirs: string[]): boolean {
  // TODO: Implement directory checking
  // Check against structure.topLevelDirs
  return false;
}

/**
 * Check if a script exists in package.json
 * @param scan Scan result
 * @param scriptName Script name
 * @returns True if script exists
 */
function hasScript(scan: ScanResult, scriptName: string): boolean {
  const scripts = scan.package.scripts || {};
  return scriptName in scripts;
}
