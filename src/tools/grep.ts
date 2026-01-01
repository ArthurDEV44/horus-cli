import type { ToolResult } from "../types/index.js";
import fs from "fs-extra";
import * as path from "path";

export type GrepOutputMode = "content" | "files_with_matches" | "count";

export interface GrepOptions {
  path?: string;
  glob?: string;
  type?: string;
  outputMode?: GrepOutputMode;
  contextBefore?: number; // -B
  contextAfter?: number; // -A
  contextAround?: number; // -C
  caseInsensitive?: boolean; // -i
  lineNumbers?: boolean; // -n (defaults to true)
  multiline?: boolean;
  headLimit?: number;
  offset?: number;
}

interface GrepMatch {
  file: string;
  line: number;
  column: number;
  text: string;
  match: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

// FileCount interface available if needed for future features
interface _FileCount {
  file: string;
  count: number;
}

// File type to extension mapping (like ripgrep)
const TYPE_MAPPINGS: Record<string, string[]> = {
  js: ["js", "mjs", "cjs"],
  ts: ["ts", "mts", "cts"],
  tsx: ["tsx"],
  jsx: ["jsx"],
  py: ["py", "pyw", "pyi"],
  rust: ["rs"],
  go: ["go"],
  java: ["java"],
  c: ["c", "h"],
  cpp: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"],
  css: ["css"],
  html: ["html", "htm"],
  json: ["json"],
  yaml: ["yaml", "yml"],
  md: ["md", "markdown"],
  sh: ["sh", "bash", "zsh"],
  sql: ["sql"],
  xml: ["xml"],
  ruby: ["rb"],
  php: ["php"],
};

/**
 * GrepTool - Content search with regex patterns
 * Built on ripgrep-like functionality
 */
export class GrepTool {
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
   * Search file contents with regex patterns
   */
  async grep(pattern: string, options: GrepOptions = {}): Promise<ToolResult> {
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

      const outputMode = options.outputMode || "files_with_matches";
      const caseInsensitive = options.caseInsensitive ?? false;
      const showLineNumbers = options.lineNumbers ?? true;
      const multiline = options.multiline ?? false;

      // Context lines
      const contextBefore = options.contextAround ?? options.contextBefore ?? 0;
      const contextAfter = options.contextAround ?? options.contextAfter ?? 0;

      // Build regex
      let regex: RegExp;
      try {
        const flags = `g${caseInsensitive ? "i" : ""}${multiline ? "ms" : ""}`;
        regex = new RegExp(pattern, flags);
      } catch (e: any) {
        return {
          success: false,
          error: `Invalid regex pattern: ${e.message}`,
        };
      }

      // Get file extensions filter
      const extensions = this.getExtensionsFilter(options.type, options.glob);

      // Search files
      const matches = await this.searchFiles(
        searchPath,
        regex,
        extensions,
        options.glob,
        contextBefore,
        contextAfter,
        multiline
      );

      // Apply offset and limit
      let results = matches;
      if (options.offset && options.offset > 0) {
        results = results.slice(options.offset);
      }
      if (options.headLimit && options.headLimit > 0) {
        results = results.slice(0, options.headLimit);
      }

      // Format output based on mode
      const output = this.formatOutput(
        results,
        outputMode,
        pattern,
        showLineNumbers,
        contextBefore > 0 || contextAfter > 0
      );

      return {
        success: true,
        output,
        data: {
          matches: results.length,
          mode: outputMode,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Grep error: ${error.message}`,
      };
    }
  }

  /**
   * Get extensions filter from type or glob
   */
  private getExtensionsFilter(
    type?: string,
    glob?: string
  ): string[] | null {
    if (type && TYPE_MAPPINGS[type]) {
      return TYPE_MAPPINGS[type];
    }

    // Extract extension from glob if simple pattern like "*.ts"
    if (glob) {
      const extMatch = glob.match(/^\*\.(\w+)$/);
      if (extMatch) {
        return [extMatch[1]];
      }
      // Handle {ts,tsx} patterns
      const braceMatch = glob.match(/^\*\.\{([^}]+)\}$/);
      if (braceMatch) {
        return braceMatch[1].split(",").map((s) => s.trim());
      }
    }

    return null;
  }

  /**
   * Search files recursively
   */
  private async searchFiles(
    dir: string,
    regex: RegExp,
    extensions: string[] | null,
    globPattern: string | undefined,
    contextBefore: number,
    contextAfter: number,
    multiline: boolean,
    depth = 0
  ): Promise<GrepMatch[]> {
    const results: GrepMatch[] = [];
    const MAX_DEPTH = 30;
    const MAX_MATCHES = 1000;

    if (depth > MAX_DEPTH || results.length >= MAX_MATCHES) return results;

    try {
      const stats = await fs.stat(dir);

      // If it's a file, search it directly
      if (stats.isFile()) {
        const fileMatches = await this.searchFile(
          dir,
          regex,
          contextBefore,
          contextAfter,
          multiline
        );
        return fileMatches;
      }

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= MAX_MATCHES) break;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.currentDirectory, fullPath);

        // Skip ignored directories
        if (entry.isDirectory()) {
          if (this.DEFAULT_IGNORE.includes(entry.name)) {
            continue;
          }
        }

        if (entry.isFile()) {
          // Check extension filter
          if (extensions) {
            const ext = path.extname(entry.name).slice(1).toLowerCase();
            if (!extensions.includes(ext)) {
              continue;
            }
          }

          // Check glob pattern if provided and more complex
          if (globPattern && !this.matchesSimpleGlob(relativePath, globPattern)) {
            continue;
          }

          const fileMatches = await this.searchFile(
            fullPath,
            regex,
            contextBefore,
            contextAfter,
            multiline
          );

          // Add file path to matches
          for (const match of fileMatches) {
            match.file = relativePath;
            results.push(match);
          }
        } else if (entry.isDirectory()) {
          const subResults = await this.searchFiles(
            fullPath,
            regex,
            extensions,
            globPattern,
            contextBefore,
            contextAfter,
            multiline,
            depth + 1
          );
          results.push(...subResults);
        }
      }
    } catch {
      // Skip directories/files we can't read
    }

    return results;
  }

  /**
   * Search a single file for matches
   */
  private async searchFile(
    filePath: string,
    regex: RegExp,
    contextBefore: number,
    contextAfter: number,
    multiline: boolean
  ): Promise<GrepMatch[]> {
    const results: GrepMatch[] = [];

    try {
      const stats = await fs.stat(filePath);
      // Skip large files (>10MB)
      if (stats.size > 10 * 1024 * 1024) return results;

      const content = await fs.readFile(filePath, "utf-8").catch(() => null);
      if (!content) return results; // Binary or unreadable

      const lines = content.split("\n");

      // Reset regex lastIndex for reuse
      regex.lastIndex = 0;

      if (multiline) {
        // Multiline mode: search across lines
        let match;
        while ((match = regex.exec(content)) !== null) {
          // Calculate line number from match index
          const beforeMatch = content.substring(0, match.index);
          const lineNum = beforeMatch.split("\n").length;
          const lineStart = beforeMatch.lastIndexOf("\n") + 1;
          const column = match.index - lineStart + 1;

          results.push({
            file: filePath,
            line: lineNum,
            column,
            text: lines[lineNum - 1] || "",
            match: match[0],
            contextBefore: this.getContextLines(lines, lineNum - 1, contextBefore, "before"),
            contextAfter: this.getContextLines(lines, lineNum - 1, contextAfter, "after"),
          });

          // Prevent infinite loop for zero-length matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } else {
        // Line-by-line mode
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          regex.lastIndex = 0;

          let match;
          while ((match = regex.exec(line)) !== null) {
            results.push({
              file: filePath,
              line: i + 1,
              column: match.index + 1,
              text: line,
              match: match[0],
              contextBefore: this.getContextLines(lines, i, contextBefore, "before"),
              contextAfter: this.getContextLines(lines, i, contextAfter, "after"),
            });

            // Prevent infinite loop
            if (match.index === regex.lastIndex) {
              regex.lastIndex++;
            }
          }
        }
      }
    } catch {
      // Skip files we can't read
    }

    return results;
  }

  /**
   * Get context lines before or after a match
   */
  private getContextLines(
    lines: string[],
    lineIndex: number,
    count: number,
    direction: "before" | "after"
  ): string[] {
    if (count <= 0) return [];

    const result: string[] = [];
    if (direction === "before") {
      const start = Math.max(0, lineIndex - count);
      for (let i = start; i < lineIndex; i++) {
        result.push(lines[i]);
      }
    } else {
      const end = Math.min(lines.length - 1, lineIndex + count);
      for (let i = lineIndex + 1; i <= end; i++) {
        result.push(lines[i]);
      }
    }
    return result;
  }

  /**
   * Simple glob matching for filtering
   */
  private matchesSimpleGlob(filePath: string, pattern: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const normalizedPattern = pattern.replace(/\\/g, "/");

    // Simple patterns
    if (normalizedPattern.startsWith("*.")) {
      const ext = normalizedPattern.slice(2);
      return normalizedPath.endsWith(`.${ext}`);
    }

    // Convert to regex
    const regexPattern = normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, "(?:.*\\/)?")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]");

    try {
      const regex = new RegExp(`^${regexPattern}$`, "i");
      return regex.test(normalizedPath);
    } catch {
      return normalizedPath.includes(normalizedPattern.replace(/[*?]/g, ""));
    }
  }

  /**
   * Format output based on mode
   */
  private formatOutput(
    matches: GrepMatch[],
    mode: GrepOutputMode,
    pattern: string,
    showLineNumbers: boolean,
    hasContext: boolean
  ): string {
    if (matches.length === 0) {
      return `No matches found for pattern: ${pattern}`;
    }

    switch (mode) {
      case "files_with_matches": {
        const files = [...new Set(matches.map((m) => m.file))];
        return files.join("\n");
      }

      case "count": {
        const counts = new Map<string, number>();
        for (const match of matches) {
          counts.set(match.file, (counts.get(match.file) || 0) + 1);
        }
        return Array.from(counts.entries())
          .map(([file, count]) => `${file}:${count}`)
          .join("\n");
      }

      case "content":
      default: {
        const lines: string[] = [];
        let lastFile = "";

        for (const match of matches) {
          // Add file separator if new file
          if (match.file !== lastFile) {
            if (lastFile !== "") lines.push("");
            lastFile = match.file;
          }

          // Add context before
          if (match.contextBefore && match.contextBefore.length > 0) {
            const startLine = match.line - match.contextBefore.length;
            for (let i = 0; i < match.contextBefore.length; i++) {
              const lineNum = startLine + i;
              const prefix = showLineNumbers ? `${match.file}:${lineNum}-` : `${match.file}-`;
              lines.push(`${prefix}${match.contextBefore[i]}`);
            }
          }

          // Add match line
          const prefix = showLineNumbers
            ? `${match.file}:${match.line}:`
            : `${match.file}:`;
          lines.push(`${prefix}${match.text}`);

          // Add context after
          if (match.contextAfter && match.contextAfter.length > 0) {
            const startLine = match.line + 1;
            for (let i = 0; i < match.contextAfter.length; i++) {
              const lineNum = startLine + i;
              const prefix = showLineNumbers ? `${match.file}:${lineNum}-` : `${match.file}-`;
              lines.push(`${prefix}${match.contextAfter[i]}`);
            }
          }

          // Add separator if has context
          if (hasContext) {
            lines.push("--");
          }
        }

        // Remove trailing separator
        if (hasContext && lines[lines.length - 1] === "--") {
          lines.pop();
        }

        return lines.join("\n");
      }
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
