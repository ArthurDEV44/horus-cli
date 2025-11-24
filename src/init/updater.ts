/**
 * Updater module for /init command
 * Handles intelligent updating of existing HORUS.md files
 */

import type { ParsedHorusFile, UpdateStrategy } from "./types.js";

// ============================================================================
// File Parsing
// ============================================================================

/**
 * Parses existing HORUS.md file
 * @param filePath Path to HORUS.md file
 * @returns Parsed file with sections and metadata
 */
export async function parseExistingFile(
  filePath: string
): Promise<ParsedHorusFile> {
  // TODO: Implement in Phase 5
  // - Read file content
  // - Split by ## headers (sections)
  // - Extract metadata (Last Updated, Version)
  // - Store in Map<sectionName, content>
  throw new Error("parseExistingFile not yet implemented");
}

// ============================================================================
// Preserve Section Extraction
// ============================================================================

/**
 * Extracts sections marked with PRESERVE tags
 * @param parsed Parsed HORUS.md file
 * @returns Map of preserved section names to content
 */
export function extractPreserveSections(
  parsed: ParsedHorusFile
): Map<string, string> {
  // TODO: Implement in Phase 5
  // - Scan for <!-- PRESERVE:START --> / <!-- PRESERVE:END --> tags
  // - Extract content between tags
  // - Store in Map<sectionName, content>
  throw new Error("extractPreserveSections not yet implemented");
}

// ============================================================================
// Content Merging
// ============================================================================

/**
 * Merges old and new content using specified strategy
 * @param oldContent Content from existing file
 * @param newContent Newly generated content
 * @param strategy Merge strategy to use
 * @returns Merged content
 */
export function mergeContent(
  oldContent: string,
  newContent: string,
  strategy: UpdateStrategy
): string {
  // TODO: Implement in Phase 5
  switch (strategy) {
    case "replace":
      // Completely replace old with new
      return newContent;

    case "merge":
      // Intelligent merge: add new items, keep old ones
      // TODO: Implement merge logic
      throw new Error("merge strategy not yet implemented");

    case "preserve":
      // Keep old content entirely
      return oldContent;

    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

/**
 * Merges sections from old and new files
 * @param oldSections Sections from existing file
 * @param newSections Newly generated sections
 * @param preservedSections Sections to preserve
 * @returns Merged sections as complete document
 */
export function mergeSections(
  oldSections: Map<string, string>,
  newSections: Map<string, string>,
  preservedSections: Map<string, string>
): string {
  // TODO: Implement in Phase 5
  // - Apply strategy for each section:
  //   - Tech Stack, Structure → replace
  //   - Features → merge
  //   - Common Tasks, Troubleshooting → preserve if has PRESERVE tag
  // - Maintain section order
  // - Rebuild complete document
  throw new Error("mergeSections not yet implemented");
}

// ============================================================================
// File Writing
// ============================================================================

/**
 * Writes updated content to file with backup
 * @param filePath Path to write to
 * @param content Content to write
 * @param createBackup Whether to create .bak backup (default: true)
 */
export async function writeUpdatedFile(
  filePath: string,
  content: string,
  createBackup: boolean = true
): Promise<void> {
  // TODO: Implement in Phase 5
  // - If createBackup: copy existing file to .bak
  // - Write new content to file
  // - Handle write errors
  throw new Error("writeUpdatedFile not yet implemented");
}

// ============================================================================
// Change Detection
// ============================================================================

/**
 * Detects significant changes between versions
 * @param oldParsed Old parsed file
 * @param newContent New generated content
 * @returns Array of detected changes
 */
export function detectChanges(
  oldParsed: ParsedHorusFile,
  newContent: string
): string[] {
  // TODO: Implement in Phase 5
  // Detect:
  // - New dependencies added
  // - Architecture changed
  // - New directories/modules
  // - Version bump
  // Return array of change descriptions
  throw new Error("detectChanges not yet implemented");
}

// ============================================================================
// Section Strategy Configuration
// ============================================================================

/**
 * Get update strategy for a section
 * @param sectionName Name of the section
 * @returns Strategy to use for this section
 */
export function getSectionStrategy(sectionName: string): UpdateStrategy {
  // TODO: Implement in Phase 5
  const strategies: Record<string, UpdateStrategy> = {
    // Replace completely (dynamic data)
    "Tech Stack": "replace",
    "Codebase Structure": "replace",
    "Directory Layout": "replace",
    "Quick Start": "replace",

    // Merge intelligently (additive)
    "Key Features": "merge",
    "Design Patterns": "merge",

    // Preserve (user-customized)
    "Common Tasks": "preserve",
    "Troubleshooting": "preserve",
    "Resources": "preserve",
  };

  return strategies[sectionName] || "replace";
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates that merged content is valid Markdown
 * @param content Markdown content to validate
 * @returns True if valid, false otherwise
 */
export function validateMarkdown(content: string): boolean {
  // TODO: Implement in Phase 5 (optional)
  // Basic validation:
  // - Check balanced code blocks (```)
  // - Check balanced HTML comments (<!-- -->)
  // - Check table formatting
  // Advanced: Use markdown-it parser
  return true;
}

/**
 * Counts lines in content
 * @param content Text content
 * @returns Number of lines
 */
export function countLines(content: string): number {
  return content.split("\n").length;
}

/**
 * Counts sections in content (## headers)
 * @param content Markdown content
 * @returns Number of sections
 */
export function countSections(content: string): number {
  const sectionRegex = /^##\s+/gm;
  return (content.match(sectionRegex) || []).length;
}
