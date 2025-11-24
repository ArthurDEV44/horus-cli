/**
 * Scanner module for /init command
 * Scans the codebase to extract metadata for documentation generation
 */

import type {
  PackageMetadata,
  TsConfigMetadata,
  GitMetadata,
  CodebaseMetadata,
  DirectoryStructure,
  ExistingDocumentation,
  ScanResult,
} from "./types.js";

// ============================================================================
// Package.json Scanner
// ============================================================================

/**
 * Scans and parses package.json
 * @returns Package metadata including dependencies, scripts, and project info
 * @throws Error if package.json is not found or invalid
 */
export async function scanPackageJson(): Promise<PackageMetadata> {
  // TODO: Implement in Phase 2
  // - Read package.json from cwd
  // - Parse JSON
  // - Extract: name, version, description, main, scripts, deps, devDeps, engines, type
  // - Handle missing fields gracefully
  throw new Error("scanPackageJson not yet implemented");
}

// ============================================================================
// TypeScript Config Scanner
// ============================================================================

/**
 * Scans and parses tsconfig.json if present
 * @returns TypeScript configuration metadata, or null if not found
 */
export async function scanTsConfig(): Promise<TsConfigMetadata | null> {
  // TODO: Implement in Phase 2
  // - Check if tsconfig.json exists
  // - Parse JSON (handle comments via json5 or strip-json-comments)
  // - Extract compilerOptions: module, target, strict, paths, outDir
  // - Return null if file doesn't exist
  throw new Error("scanTsConfig not yet implemented");
}

// ============================================================================
// Git Metadata Scanner
// ============================================================================

/**
 * Scans git metadata (commits, branch, remote)
 * @returns Git metadata including recent commits and repository info
 */
export async function scanGitMetadata(): Promise<GitMetadata> {
  // TODO: Implement in Phase 2
  // - Execute: git remote get-url origin (for repo URL)
  // - Execute: git rev-parse --abbrev-ref HEAD (for current branch)
  // - Execute: git log --pretty=format:"%H|%an|%ae|%ad|%s" --date=short -20
  // - Parse commits into GitCommit[]
  // - Handle non-git repositories gracefully (return defaults)
  throw new Error("scanGitMetadata not yet implemented");
}

// ============================================================================
// Directory Structure Scanner
// ============================================================================

/**
 * Scans directory structure and generates ASCII tree
 * @param maxDepth Maximum depth to scan (default: 3)
 * @returns Directory structure with ASCII tree representation
 */
export async function scanDirectoryStructure(
  maxDepth: number = 3
): Promise<DirectoryStructure> {
  // TODO: Implement in Phase 2
  // - Use fast-glob or tree-node-cli
  // - Generate ASCII tree with max depth
  // - Exclude: node_modules, .git, dist, build, .horus, coverage
  // - Return tree as string + top-level dirs
  throw new Error("scanDirectoryStructure not yet implemented");
}

// ============================================================================
// Codebase Statistics Scanner
// ============================================================================

/**
 * Scans codebase to gather file and line statistics
 * @returns Statistics about files, lines of code, and languages
 */
export async function scanCodebaseStats(): Promise<CodebaseMetadata> {
  // TODO: Implement in Phase 2
  // - Use fast-glob to find all files
  // - Count files by extension (.ts, .tsx, .js, .jsx, .py, .rs, etc.)
  // - Count total lines (estimate via wc or manual read)
  // - Detect primary language (most files)
  // - Count test files (*.spec.*, *.test.*, __tests__/*)
  throw new Error("scanCodebaseStats not yet implemented");
}

// ============================================================================
// Existing Documentation Scanner
// ============================================================================

/**
 * Scans for existing documentation files
 * @returns Paths and content of existing documentation
 */
export async function scanExistingDocs(): Promise<ExistingDocumentation> {
  // TODO: Implement in Phase 2
  // - Check for: README.md, CLAUDE.md, GEMINI.md, CONTRIBUTING.md, ARCHITECTURE.md
  // - Check for: .cursor/rules/**, .github/copilot-instructions.md
  // - Read relevant sections (features, architecture)
  // - Return paths or content snippets
  throw new Error("scanExistingDocs not yet implemented");
}

// ============================================================================
// Main Scan Orchestrator
// ============================================================================

/**
 * Orchestrates all scanning operations
 * @param includeGit Whether to include git metadata (default: true)
 * @param maxDepth Maximum directory depth (default: 3)
 * @returns Complete scan result
 */
export async function scanRepository(
  includeGit: boolean = true,
  maxDepth: number = 3
): Promise<ScanResult> {
  // TODO: Implement orchestration in Phase 2
  // - Call all scan functions
  // - Aggregate results
  // - Handle errors gracefully (partial results OK)

  const packageMeta = await scanPackageJson();
  const tsconfig = await scanTsConfig();
  const git = includeGit ? await scanGitMetadata() : createDefaultGitMetadata();
  const codebase = await scanCodebaseStats();
  const structure = await scanDirectoryStructure(maxDepth);
  const existingDocs = await scanExistingDocs();

  return {
    package: packageMeta,
    tsconfig,
    git,
    codebase,
    structure,
    existingDocs,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates default git metadata when not a git repository
 */
function createDefaultGitMetadata(): GitMetadata {
  return {
    branch: "main",
    lastCommitDate: new Date().toISOString().split("T")[0],
    contributors: [],
    recentCommits: [],
    hasRemote: false,
  };
}
