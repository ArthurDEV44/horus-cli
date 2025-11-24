/**
 * Types for the /init command
 * Defines interfaces for repository scanning, detection, and documentation generation
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface InitConfig {
  /** Target file to generate/update (default: HORUS.md) */
  targetFile?: string;
  /** Force full regeneration, ignoring existing file */
  forceRegenerate?: boolean;
  /** Preserve custom sections with PRESERVE tags (default: true) */
  preserveSections?: boolean;
  /** Include git history metadata (default: true) */
  includeGitHistory?: boolean;
  /** Maximum directory scan depth (default: 3) */
  maxDepth?: number;
  /** Verbose output (default: false) */
  verbose?: boolean;
}

// ============================================================================
// Scan Result Types
// ============================================================================

export interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  main?: string;
  type?: "module" | "commonjs";
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  engines?: {
    node?: string;
    npm?: string;
    bun?: string;
  };
  keywords?: string[];
  author?: string;
  license?: string;
  repository?: {
    type: string;
    url: string;
  };
}

export interface TsConfigMetadata {
  compilerOptions?: {
    module?: string;
    target?: string;
    strict?: boolean;
    outDir?: string;
    rootDir?: string;
    paths?: Record<string, string[]>;
    lib?: string[];
    types?: string[];
    esModuleInterop?: boolean;
  };
  include?: string[];
  exclude?: string[];
}

export interface GitMetadata {
  repository?: string;
  branch: string;
  lastCommitDate: string;
  contributors: string[];
  recentCommits: GitCommit[];
  hasRemote: boolean;
}

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface CodebaseMetadata {
  totalFiles: number;
  totalLines: number;
  filesByType: Record<string, number>; // .ts: 45, .tsx: 23, etc.
  primaryLanguage: string;
  testFiles: number;
  testFramework?: string;
}

export interface DirectoryStructure {
  tree: string; // ASCII tree representation
  topLevelDirs: string[];
  depth: number;
}

export interface ExistingDocumentation {
  readme?: string;
  claude?: string;
  gemini?: string;
  contributing?: string;
  architecture?: string;
  cursorRules?: string[];
  copilotInstructions?: string;
}

export interface ScanResult {
  package: PackageMetadata;
  tsconfig?: TsConfigMetadata;
  git: GitMetadata;
  codebase: CodebaseMetadata;
  structure: DirectoryStructure;
  existingDocs: ExistingDocumentation;
}

// ============================================================================
// Detection Result Types
// ============================================================================

export type FrameworkType =
  | "react"
  | "nextjs"
  | "vue"
  | "svelte"
  | "angular"
  | "express"
  | "fastify"
  | "nestjs"
  | "koa"
  | "commander"
  | "yargs"
  | "ink"
  | "oclif";

export type ArchitectureType =
  | "mvc"
  | "clean"
  | "hexagonal"
  | "agent-based"
  | "microservices"
  | "monorepo"
  | "layered";

export type TestFrameworkType = "jest" | "vitest" | "bun" | "mocha" | "ava";

export type BuildToolType =
  | "webpack"
  | "vite"
  | "rollup"
  | "esbuild"
  | "turbopack"
  | "tsc";

export interface ProjectConventions {
  /** ESM or CommonJS */
  moduleSystem: "ESM" | "CommonJS";
  /** ES target (ES2022, ES2020, etc.) */
  target?: string;
  /** TypeScript strict mode enabled */
  strict: boolean;
  /** Path aliases configured */
  hasPathAliases: boolean;
  /** File naming convention detected */
  fileNaming: "kebab-case" | "camelCase" | "PascalCase" | "mixed";
  /** Import extensions (.js, .ts, none) */
  importExtensions: ".js" | ".ts" | "none" | "mixed";
}

export interface DetectionResult {
  frameworks: FrameworkType[];
  architecture: ArchitectureType | null;
  conventions: ProjectConventions;
  testFramework: TestFrameworkType | null;
  buildTool: BuildToolType | null;
}

// ============================================================================
// Generation Context Types
// ============================================================================

export interface GenerationContext {
  scan: ScanResult;
  detection: DetectionResult;
  existingContent?: ParsedHorusFile;
  config: InitConfig;
}

// ============================================================================
// Parsed File Types
// ============================================================================

export interface ParsedHorusFile {
  /** Sections parsed from existing file */
  sections: Map<string, string>;
  /** Sections marked with PRESERVE tags */
  preservedSections: Map<string, string>;
  /** Metadata extracted from file */
  metadata: {
    lastUpdated: Date;
    version: string;
    projectName: string;
  };
}

// ============================================================================
// Result Types
// ============================================================================

export interface InitResult {
  /** Whether file was created (true) or updated (false) */
  created: boolean;
  /** Path to the generated/updated file */
  filePath: string;
  /** Number of lines written */
  linesWritten: number;
  /** Number of sections generated */
  sectionsGenerated: number;
  /** Number of sections preserved from existing file */
  preservedSections: number;
  /** Warnings encountered during generation */
  warnings: string[];
}

// ============================================================================
// Update Strategy Types
// ============================================================================

export type UpdateStrategy = "replace" | "merge" | "preserve";

export interface SectionUpdateConfig {
  name: string;
  strategy: UpdateStrategy;
  priority: number; // Order in final document
}

// ============================================================================
// Helper Types
// ============================================================================

export interface DependencyInfo {
  name: string;
  version: string;
  type: "dependency" | "devDependency";
  isFramework: boolean;
}

export interface FileStats {
  path: string;
  extension: string;
  lines: number;
  size: number;
}
