import type { ToolResult } from "../types/index.js";
import fs from "fs-extra";
import * as path from "path";

export interface GlobOptions {
  path?: string;
  ignore?: string[];
}

interface FileInfo {
  path: string;
  mtime: number;
}

/**
 * GlobTool - Fast file pattern matching tool
 * Matches files using glob patterns (e.g., "**\/*.ts", "src/**\/*.tsx")
 * Returns matching file paths sorted by modification time (most recent first)
 */
export class GlobTool {
  private currentDirectory: string = process.cwd();

  private readonly DEFAULT_IGNORE = [
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

  /**
   * Find files matching a glob pattern
   */
  async glob(pattern: string, options: GlobOptions = {}): Promise<ToolResult> {
    try {
      const searchPath = options.path
        ? path.resolve(this.currentDirectory, options.path)
        : this.currentDirectory;

      // Verify path exists
      if (!(await fs.pathExists(searchPath))) {
        return {
          success: false,
          error: `Path does not exist: ${searchPath}`,
        };
      }

      const ignorePatterns = [
        ...this.DEFAULT_IGNORE,
        ...(options.ignore || []),
      ];

      const files = await this.findFiles(searchPath, pattern, ignorePatterns);

      // Sort by modification time (most recent first)
      files.sort((a, b) => b.mtime - a.mtime);

      const relativePaths = files.map((f) =>
        path.relative(this.currentDirectory, f.path)
      );

      if (relativePaths.length === 0) {
        return {
          success: true,
          output: `No files found matching pattern: ${pattern}`,
        };
      }

      const output = relativePaths.join("\n");
      return {
        success: true,
        output,
        data: { files: relativePaths, count: relativePaths.length },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Glob error: ${error.message}`,
      };
    }
  }

  /**
   * Recursively find files matching the glob pattern
   */
  private async findFiles(
    dir: string,
    pattern: string,
    ignorePatterns: string[],
    depth: number = 0
  ): Promise<FileInfo[]> {
    const results: FileInfo[] = [];
    const MAX_DEPTH = 30;

    if (depth > MAX_DEPTH) return results;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.currentDirectory, fullPath);

        // Skip ignored directories
        if (entry.isDirectory()) {
          if (ignorePatterns.includes(entry.name)) {
            continue;
          }
          // Also check pattern-based ignores
          if (
            ignorePatterns.some(
              (p) =>
                p.includes("/") && this.matchesGlobPattern(relativePath, p)
            )
          ) {
            continue;
          }
        }

        if (entry.isFile()) {
          if (this.matchesGlobPattern(relativePath, pattern)) {
            try {
              const stats = await fs.stat(fullPath);
              results.push({
                path: fullPath,
                mtime: stats.mtimeMs,
              });
            } catch {
              // Skip files we can't stat
            }
          }
        } else if (entry.isDirectory()) {
          const subResults = await this.findFiles(
            fullPath,
            pattern,
            ignorePatterns,
            depth + 1
          );
          results.push(...subResults);
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return results;
  }

  /**
   * Match a file path against a glob pattern
   * Supports: *, **, ?, {a,b}, [abc]
   */
  private matchesGlobPattern(filePath: string, pattern: string): boolean {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, "/");
    const normalizedPattern = pattern.replace(/\\/g, "/");

    // Convert glob pattern to regex
    let regexPattern = normalizedPattern
      // Escape special regex characters (except glob chars)
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      // Handle **/ (match any directory depth)
      .replace(/\*\*\//g, "(?:.*\\/)?")
      // Handle ** at the end or standalone
      .replace(/\*\*/g, ".*")
      // Handle * (match anything except /)
      .replace(/\*/g, "[^/]*")
      // Handle ? (match single character except /)
      .replace(/\?/g, "[^/]");

    // Handle brace expansion {a,b,c}
    const braceMatch = regexPattern.match(/\\{([^}]+)\\}/);
    if (braceMatch) {
      const options = braceMatch[1].split(",").map((s) => s.trim());
      regexPattern = regexPattern.replace(
        /\\{[^}]+\\}/,
        `(?:${options.join("|")})`
      );
    }

    try {
      const regex = new RegExp(`^${regexPattern}$`, "i");
      return regex.test(normalizedPath);
    } catch {
      // Fallback to simple includes check
      return normalizedPath.includes(normalizedPattern.replace(/[*?]/g, ""));
    }
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
