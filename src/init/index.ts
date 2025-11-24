/**
 * Init module exports
 * Provides documentation generation functionality for Horus CLI
 */

// Types
export type {
  InitConfig,
  InitResult,
  ScanResult,
  DetectionResult,
  GenerationContext,
  PackageMetadata,
  TsConfigMetadata,
  GitMetadata,
  CodebaseMetadata,
  DirectoryStructure,
  ExistingDocumentation,
  ParsedHorusFile,
  FrameworkType,
  ArchitectureType,
  TestFrameworkType,
  BuildToolType,
  ProjectConventions,
  UpdateStrategy,
} from "./types.js";

// Scanner
export {
  scanPackageJson,
  scanTsConfig,
  scanGitMetadata,
  scanDirectoryStructure,
  scanCodebaseStats,
  scanExistingDocs,
  scanRepository,
} from "./scanner.js";

// Detector
export {
  detectFrameworks,
  detectArchitecture,
  detectConventions,
  detectTestFramework,
  detectBuildTool,
  detectAll,
} from "./detector.js";

// Generator
export {
  generateFromTemplate,
  generateTechStackTable,
  generateDirectoryTree,
  generateArchitectureDiagram,
  generateQuickStart,
  generateConventionsSection,
  generateTestingSection,
  generateOverviewSection,
  generateWorkflowsSection,
  replacePlaceholders,
  formatList,
  formatTable,
  formatCodeBlock,
  generateTableOfContents,
} from "./generator.js";

// Updater
export {
  parseExistingFile,
  extractPreserveSections,
  mergeContent,
  mergeSections,
  writeUpdatedFile,
  detectChanges,
  getSectionStrategy,
  validateMarkdown,
  countLines,
  countSections,
} from "./updater.js";
