import type { ToolResult } from "../types/index.js";
import fs from "fs-extra";
import * as path from "path";

export interface LsOptions {
  ignore?: string[];
  all?: boolean; // Include hidden files
  long?: boolean; // Long format with details
  recursive?: boolean; // Recursive listing
  depth?: number; // Max recursion depth (default 1)
}

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modified: Date;
  permissions?: string;
}

/**
 * LsTool - Directory listing with ignore patterns
 * Lists directory contents with optional details
 */
export class LsTool {
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
   * List directory contents
   */
  async ls(targetPath?: string, options: LsOptions = {}): Promise<ToolResult> {
    try {
      const resolvedPath = targetPath
        ? path.resolve(this.currentDirectory, targetPath)
        : this.currentDirectory;

      // Verify path exists
      if (!(await fs.pathExists(resolvedPath))) {
        return {
          success: false,
          error: `Path does not exist: ${resolvedPath}`,
        };
      }

      const stats = await fs.stat(resolvedPath);

      // If it's a file, return file info
      if (stats.isFile()) {
        const entry = await this.getFileEntry(resolvedPath, path.dirname(resolvedPath));
        const output = options.long
          ? this.formatLongEntry(entry)
          : entry.name;
        return {
          success: true,
          output,
          data: { entries: [entry] },
        };
      }

      const ignorePatterns = [
        ...this.DEFAULT_IGNORE,
        ...(options.ignore || []),
      ];

      const showAll = options.all ?? false;
      const showLong = options.long ?? false;
      const recursive = options.recursive ?? false;
      const maxDepth = options.depth ?? 1;

      const entries = await this.listDirectory(
        resolvedPath,
        ignorePatterns,
        showAll,
        recursive,
        maxDepth,
        0
      );

      if (entries.length === 0) {
        return {
          success: true,
          output: "(empty directory)",
          data: { entries: [] },
        };
      }

      // Sort: directories first, then files, alphabetically
      entries.sort((a, b) => {
        if (a.type === "directory" && b.type !== "directory") return -1;
        if (a.type !== "directory" && b.type === "directory") return 1;
        return a.name.localeCompare(b.name);
      });

      const output = showLong
        ? this.formatLongListing(entries, resolvedPath)
        : this.formatSimpleListing(entries, resolvedPath, recursive);

      return {
        success: true,
        output,
        data: {
          entries: entries.map((e) => ({
            name: e.name,
            path: path.relative(this.currentDirectory, e.path),
            type: e.type,
            size: e.size,
            modified: e.modified.toISOString(),
          })),
          count: entries.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `ls error: ${error.message}`,
      };
    }
  }

  /**
   * List directory entries recursively
   */
  private async listDirectory(
    dir: string,
    ignorePatterns: string[],
    showAll: boolean,
    recursive: boolean,
    maxDepth: number,
    currentDepth: number
  ): Promise<FileEntry[]> {
    const results: FileEntry[] = [];

    if (currentDepth >= maxDepth && recursive) return results;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip hidden files unless showAll
        if (!showAll && entry.name.startsWith(".")) {
          continue;
        }

        // Skip ignored patterns
        if (ignorePatterns.includes(entry.name)) {
          continue;
        }

        const fileEntry = await this.getFileEntry(fullPath, dir);
        results.push(fileEntry);

        // Recurse into directories
        if (recursive && entry.isDirectory() && currentDepth < maxDepth - 1) {
          const subEntries = await this.listDirectory(
            fullPath,
            ignorePatterns,
            showAll,
            recursive,
            maxDepth,
            currentDepth + 1
          );
          results.push(...subEntries);
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return results;
  }

  /**
   * Get file entry info
   */
  private async getFileEntry(fullPath: string, _baseDir: string): Promise<FileEntry> {
    const stats = await fs.lstat(fullPath);
    const name = path.basename(fullPath);

    let type: "file" | "directory" | "symlink" = "file";
    if (stats.isDirectory()) type = "directory";
    else if (stats.isSymbolicLink()) type = "symlink";

    return {
      name,
      path: fullPath,
      type,
      size: stats.size,
      modified: stats.mtime,
      permissions: this.formatPermissions(stats.mode),
    };
  }

  /**
   * Format Unix-style permissions
   */
  private formatPermissions(mode: number): string {
    const perms = [
      mode & 0o400 ? "r" : "-",
      mode & 0o200 ? "w" : "-",
      mode & 0o100 ? "x" : "-",
      mode & 0o040 ? "r" : "-",
      mode & 0o020 ? "w" : "-",
      mode & 0o010 ? "x" : "-",
      mode & 0o004 ? "r" : "-",
      mode & 0o002 ? "w" : "-",
      mode & 0o001 ? "x" : "-",
    ];
    return perms.join("");
  }

  /**
   * Format file size for display
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const month = date.toLocaleString("en-US", { month: "short" });
    const day = date.getDate().toString().padStart(2, " ");

    if (date > sixMonthsAgo) {
      const time = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `${month} ${day} ${time}`;
    } else {
      return `${month} ${day}  ${date.getFullYear()}`;
    }
  }

  /**
   * Format single entry for long listing
   */
  private formatLongEntry(entry: FileEntry): string {
    const typeChar = entry.type === "directory" ? "d" : entry.type === "symlink" ? "l" : "-";
    const perms = entry.permissions || "---------";
    const size = this.formatSize(entry.size).padStart(6);
    const date = this.formatDate(entry.modified);
    const suffix = entry.type === "directory" ? "/" : "";

    return `${typeChar}${perms} ${size} ${date} ${entry.name}${suffix}`;
  }

  /**
   * Format long listing output
   */
  private formatLongListing(entries: FileEntry[], _baseDir: string): string {
    const lines = entries.map((entry) => this.formatLongEntry(entry));
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    return `total ${this.formatSize(totalSize)}\n${lines.join("\n")}`;
  }

  /**
   * Format simple listing output
   */
  private formatSimpleListing(
    entries: FileEntry[],
    baseDir: string,
    recursive: boolean
  ): string {
    if (!recursive) {
      return entries
        .map((e) => e.name + (e.type === "directory" ? "/" : ""))
        .join("\n");
    }

    // Group by directory for recursive listing
    const grouped = new Map<string, FileEntry[]>();
    for (const entry of entries) {
      const dir = path.dirname(entry.path);
      const relDir = path.relative(baseDir, dir);
      const key = relDir || ".";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      const entries = grouped.get(key);
      if (entries) {
        entries.push(entry);
      }
    }

    const lines: string[] = [];
    for (const [dir, dirEntries] of grouped) {
      if (lines.length > 0) lines.push("");
      lines.push(`${dir}:`);
      for (const entry of dirEntries) {
        const suffix = entry.type === "directory" ? "/" : "";
        lines.push(`  ${entry.name}${suffix}`);
      }
    }

    return lines.join("\n");
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
