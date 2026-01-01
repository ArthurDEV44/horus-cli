import { ToolResult } from "../types/index.js";
import { ConfirmationService } from "../utils/confirmation-service.js";
import { ContextTelemetry } from "../utils/context-telemetry.js";
import { createTokenCounter } from "../utils/token-counter.js";
import fs from "fs-extra";
import * as path from "path";

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  match: string;
}

export interface FileSearchResult {
  path: string;
  name: string;
  score: number;
}

export interface UnifiedSearchResult {
  type: "text" | "file";
  file: string;
  line?: number;
  column?: number;
  text?: string;
  match?: string;
  score?: number;
}

export class SearchTool {
  private confirmationService = ConfirmationService.getInstance();
  private currentDirectory: string = process.cwd();

  /**
   * Unified search method that can search for text content or find files
   */
  async search(
    query: string,
    options: {
      searchType?: "text" | "files" | "both";
      includePattern?: string;
      excludePattern?: string;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      regex?: boolean;
      maxResults?: number;
      fileTypes?: string[];
      excludeFiles?: string[];
      includeHidden?: boolean;
    } = {}
  ): Promise<ToolResult> {
    const telemetry = ContextTelemetry.getInstance();
    const startTime = Date.now();

    try {
      const searchType = options.searchType || "both";
      const results: UnifiedSearchResult[] = [];

      // Search for text content if requested
      if (searchType === "text" || searchType === "both") {
        const textResults = await this.executeRipgrep(query, options);
        results.push(
          ...textResults.map((r) => ({
            type: "text" as const,
            file: r.file,
            line: r.line,
            column: r.column,
            text: r.text,
            match: r.match,
          }))
        );
      }

      // Search for files if requested
      if (searchType === "files" || searchType === "both") {
        const fileResults = await this.findFilesByPattern(query, options);
        results.push(
          ...fileResults.map((r) => ({
            type: "file" as const,
            file: r.path,
            score: r.score,
          }))
        );
      }

      if (results.length === 0) {
        const result: ToolResult = {
          success: true,
          output: `No results found for "${query}"`,
        };

        // Record telemetry
        const tokenCounter = createTokenCounter();
        telemetry.recordMetric({
          operation: 'search',
          timestamp: startTime,
          duration: Date.now() - startTime,
          filesScanned: 0,
          filesMatched: 0,
          tokensEstimated: tokenCounter.countTokens(result.output),
          pattern: query,
          strategy: 'agentic-search',
        });
        tokenCounter.dispose();

        return result;
      }

      const formattedOutput = this.formatUnifiedResults(
        results,
        query,
        searchType
      );

      const result: ToolResult = {
        success: true,
        output: formattedOutput,
      };

      // Record telemetry
      const uniqueFiles = new Set(results.map(r => r.file));
      const tokenCounter = createTokenCounter();
      telemetry.recordMetric({
        operation: 'search',
        timestamp: startTime,
        duration: Date.now() - startTime,
        filesScanned: uniqueFiles.size,
        filesMatched: uniqueFiles.size,
        tokensEstimated: tokenCounter.countTokens(formattedOutput),
        pattern: query,
        strategy: 'agentic-search',
      });
      tokenCounter.dispose();

      return result;
    } catch (error: any) {
      // Record telemetry even on error
      telemetry.recordMetric({
        operation: 'search',
        timestamp: startTime,
        duration: Date.now() - startTime,
        filesScanned: 0,
        filesMatched: 0,
        tokensEstimated: 0,
        pattern: query,
        strategy: 'agentic-search',
      });

      return {
        success: false,
        error: `Search error: ${error.message}`,
      };
    }
  }

  /**
   * Native Node.js text search implementation (replaces ripgrep)
   */
  private async executeRipgrep(
    query: string,
    options: {
      includePattern?: string;
      excludePattern?: string;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      regex?: boolean;
      maxResults?: number;
      fileTypes?: string[];
      excludeFiles?: string[];
    }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const maxResults = options.maxResults || 100;
    const caseSensitive = options.caseSensitive || false;
    const wholeWord = options.wholeWord || false;
    const useRegex = options.regex || false;

    // Build search pattern
    let searchPattern: RegExp | string;
    if (useRegex) {
      try {
        searchPattern = new RegExp(
          wholeWord ? `\\b${query}\\b` : query,
          caseSensitive ? "g" : "gi"
        );
      } catch {
        // Invalid regex, fallback to literal string
        searchPattern = caseSensitive ? query : query.toLowerCase();
      }
    } else {
      searchPattern = caseSensitive ? query : query.toLowerCase();
    }

    const excludedDirs = [
      "node_modules",
      ".git",
      ".svn",
      ".hg",
      "dist",
      "build",
      ".next",
      ".cache",
      ".npm",
      ".yarn",
      ".pnpm",
      "__pycache__",
      ".pytest_cache",
      ".mypy_cache",
      "coverage",
      ".nyc_output",
    ];

    const walkAndSearch = async (dir: string, depth = 0): Promise<void> => {
      if (depth > 20 || results.length >= maxResults) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) break;

          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.currentDirectory, fullPath);

          // Skip excluded directories
          if (entry.isDirectory() && excludedDirs.includes(entry.name)) {
            continue;
          }

          // Apply exclude pattern
          if (
            options.excludePattern &&
            this.matchesGlob(relativePath, options.excludePattern)
          ) {
            continue;
          }

          // Apply exclude files
          if (
            options.excludeFiles &&
            options.excludeFiles.some((exFile) => relativePath.includes(exFile))
          ) {
            continue;
          }

          // Apply include pattern
          if (
            options.includePattern &&
            !this.matchesGlob(relativePath, options.includePattern)
          ) {
            continue;
          }

          // Apply file type filter
          if (options.fileTypes) {
            const ext = path.extname(entry.name).slice(1);
            if (!options.fileTypes.includes(ext)) {
              continue;
            }
          }

          if (entry.isFile()) {
            try {
              // Skip binary files and large files
              const stats = await fs.stat(fullPath);
              if (stats.size > 10 * 1024 * 1024) continue; // Skip files > 10MB

              const content = await fs.readFile(fullPath, "utf-8").catch(() => null);
              if (!content) continue; // Skip binary or unreadable files

              const lines = content.split("\n");
              let foundMatches = false;

              for (let lineNum = 0; lineNum < lines.length; lineNum++) {
                if (results.length >= maxResults) break;

                const line = lines[lineNum];
                let matches: { index: number; length: number; [0]: string }[] = [];

                if (useRegex && searchPattern instanceof RegExp) {
                  const lineMatches = Array.from(line.matchAll(searchPattern)) as RegExpMatchArray[];
                  matches = lineMatches.map((match) => ({
                    index: match.index || 0,
                    length: match[0].length,
                    [0]: match[0],
                  }));
                } else {
                  const searchText = caseSensitive ? line : line.toLowerCase();
                  const queryText =
                    typeof searchPattern === "string"
                      ? searchPattern
                      : query.toLowerCase();
                  const index = searchText.indexOf(queryText);

                  if (index !== -1) {
                    // Check whole word if required
                    if (wholeWord) {
                      const before = index > 0 ? line[index - 1] : " ";
                      const after =
                        index + queryText.length < line.length
                          ? line[index + queryText.length]
                          : " ";
                      const wordBoundary = /[\s\W]/.test(before) && /[\s\W]/.test(after);
                      if (!wordBoundary) continue;
                    }

                    matches.push({
                      index,
                      length: queryText.length,
                      [0]: line.substring(index, index + queryText.length),
                    });
                  }
                }

                for (const match of matches) {
                  const matchText = match[0] || "";
                  const column = match.index + 1;

                  results.push({
                    file: relativePath,
                    line: lineNum + 1,
                    column,
                    text: line.trim(),
                    match: matchText,
                  });
                  foundMatches = true;
                }
              }

              // Limit results per file
              if (foundMatches && results.length >= maxResults) break;
            } catch {
              // Skip files we can't read
              continue;
            }
          } else if (entry.isDirectory()) {
            await walkAndSearch(fullPath, depth + 1);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await walkAndSearch(this.currentDirectory);
    return results;
  }

  /**
   * Simple glob pattern matcher (basic implementation)
   */
  private matchesGlob(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(filePath);
    } catch {
      return filePath.includes(pattern);
    }
  }

  /**
   * Find files by pattern using a simple file walking approach
   */
  private async findFilesByPattern(
    pattern: string,
    options: {
      maxResults?: number;
      includeHidden?: boolean;
      excludePattern?: string;
    }
  ): Promise<FileSearchResult[]> {
    const files: FileSearchResult[] = [];
    const maxResults = options.maxResults || 50;
    const searchPattern = pattern.toLowerCase();

    const walkDir = async (dir: string, depth = 0): Promise<void> => {
      // Increase depth limit to 20 to search in deeply nested directories like .github/workflows/
      if (depth > 20 || files.length >= maxResults) return; // Prevent infinite recursion and limit results

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (files.length >= maxResults) break;

          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.currentDirectory, fullPath);

          // Skip specific hidden directories that should be ignored
          // Note: .github, .vscode, .horus are legitimate config dirs and should NOT be skipped
          if (
            entry.isDirectory() &&
            [
              "node_modules",
              ".git",         // Git history (large, not useful)
              ".svn",         // SVN history
              ".hg",          // Mercurial history
              "dist",         // Build output
              "build",        // Build output
              ".next",        // Next.js build
              ".cache",       // Cache directory
              ".npm",         // NPM cache
              ".yarn",        // Yarn cache
              ".pnpm",        // PNPM cache
              "__pycache__",  // Python cache
              ".pytest_cache",// Pytest cache
              ".mypy_cache",  // MyPy cache
              "coverage",     // Coverage reports
              ".nyc_output",  // NYC coverage
            ].includes(entry.name)
          ) {
            continue;
          }

          // Skip hidden files (but NOT directories like .github)
          if (!options.includeHidden && entry.name.startsWith(".") && !entry.isDirectory()) {
            continue;
          }

          // Apply exclude pattern
          if (
            options.excludePattern &&
            relativePath.includes(options.excludePattern)
          ) {
            continue;
          }

          if (entry.isFile()) {
            const score = this.calculateFileScore(
              entry.name,
              relativePath,
              searchPattern
            );
            if (score > 0) {
              files.push({
                path: relativePath,
                name: entry.name,
                score,
              });
            }
          } else if (entry.isDirectory()) {
            await walkDir(fullPath, depth + 1);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await walkDir(this.currentDirectory);

    // Sort by score (descending) and return top results
    return files.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }

  /**
   * Calculate fuzzy match score for file names
   */
  private calculateFileScore(
    fileName: string,
    filePath: string,
    pattern: string
  ): number {
    const lowerFileName = fileName.toLowerCase();
    const lowerFilePath = filePath.toLowerCase().replace(/\\/g, "/"); // Normalize path separators for Windows

    // Exact filename match gets highest score
    if (lowerFileName === pattern) return 100;
    
    // Filename contains pattern - very high score
    if (lowerFileName.includes(pattern)) return 90;

    // Exact path match (including subdirectories like .github/workflows/security.yml)
    if (lowerFilePath === pattern || lowerFilePath.endsWith(`/${pattern}`)) return 85;

    // Path contains pattern - good score
    if (lowerFilePath.includes(pattern)) {
      // Better score if it's in the filename part rather than directory
      const fileNameInPath = lowerFilePath.split("/").pop() || "";
      if (fileNameInPath.includes(pattern)) {
        return 70;
      }
      return 60;
    }

    // Fuzzy matching - check if all characters of pattern exist in order in filename
    let patternIndex = 0;
    for (
      let i = 0;
      i < lowerFileName.length && patternIndex < pattern.length;
      i++
    ) {
      if (lowerFileName[i] === pattern[patternIndex]) {
        patternIndex++;
      }
    }

    if (patternIndex === pattern.length) {
      // All characters found in order - score based on how close they are
      return Math.max(10, 40 - (fileName.length - pattern.length));
    }

    // Try fuzzy matching on full path (useful for finding files in subdirectories)
    patternIndex = 0;
    for (
      let i = 0;
      i < lowerFilePath.length && patternIndex < pattern.length;
      i++
    ) {
      if (lowerFilePath[i] === pattern[patternIndex]) {
        patternIndex++;
      }
    }

    if (patternIndex === pattern.length) {
      return Math.max(5, 20 - (filePath.length - pattern.length));
    }

    return 0;
  }

  /**
   * Format unified search results for display
   */
  private formatUnifiedResults(
    results: UnifiedSearchResult[],
    query: string,
    _searchType: string
  ): string {
    if (results.length === 0) {
      return `No results found for "${query}"`;
    }

    let output = `Search results for "${query}":\n`;

    // Separate text and file results
    const textResults = results.filter((r) => r.type === "text");
    const fileResults = results.filter((r) => r.type === "file");

    // Show all unique files (from both text matches and file matches)
    const allFiles = new Set<string>();

    // Add files from text results
    textResults.forEach((result) => {
      allFiles.add(result.file);
    });

    // Add files from file search results
    fileResults.forEach((result) => {
      allFiles.add(result.file);
    });

    const fileList = Array.from(allFiles);
    const displayLimit = 8;

    // Show files in compact format
    fileList.slice(0, displayLimit).forEach((file) => {
      // Count matches in this file for text results
      const matchCount = textResults.filter((r) => r.file === file).length;
      const matchIndicator = matchCount > 0 ? ` (${matchCount} matches)` : "";
      output += `  ${file}${matchIndicator}\n`;
    });

    // Show "+X more" if there are additional results
    if (fileList.length > displayLimit) {
      const remaining = fileList.length - displayLimit;
      output += `  ... +${remaining} more\n`;
    }

    return output.trim();
  }

  /**
   * Update current working directory
   */
  setCurrentDirectory(directory: string): void {
    this.currentDirectory = directory;
  }

  /**
   * Get current working directory
   */
  getCurrentDirectory(): string {
    return this.currentDirectory;
  }
}
