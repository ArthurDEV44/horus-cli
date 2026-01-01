import type { ToolResult } from "../types/index.js";
import fs from "fs-extra";
import * as path from "path";

export interface Edit {
  old_string: string;
  new_string: string;
}

export interface MultiEditOptions {
  dryRun?: boolean; // Preview changes without applying
}

interface EditResult {
  index: number;
  old_string: string;
  new_string: string;
  line: number;
  success: boolean;
  error?: string;
}

/**
 * MultiEditTool - Atomic multiple edits in a single file
 * All edits are applied atomically (all succeed or all fail)
 */
export class MultiEditTool {
  private currentDirectory: string = process.cwd();

  /**
   * Apply multiple edits to a file atomically
   */
  async multiEdit(
    filePath: string,
    edits: Edit[],
    options: MultiEditOptions = {}
  ): Promise<ToolResult> {
    try {
      const resolvedPath = path.resolve(this.currentDirectory, filePath);
      const relativePath = path.relative(this.currentDirectory, resolvedPath);

      // Verify file exists
      if (!(await fs.pathExists(resolvedPath))) {
        return {
          success: false,
          error: `File does not exist: ${relativePath}`,
        };
      }

      // Check it's a file
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: `Not a file: ${relativePath}`,
        };
      }

      // Validate edits array
      if (!edits || !Array.isArray(edits) || edits.length === 0) {
        return {
          success: false,
          error: "No edits provided. Must provide an array of {old_string, new_string} objects.",
        };
      }

      // Read file content
      let content = await fs.readFile(resolvedPath, "utf-8");
      const originalContent = content;

      // Validate all edits first (dry run validation)
      const validationResults = this.validateEdits(content, edits);
      const invalidEdits = validationResults.filter((r) => !r.success);

      if (invalidEdits.length > 0) {
        const errors = invalidEdits.map((e) => `  Edit ${e.index + 1}: ${e.error}`).join("\n");
        return {
          success: false,
          error: `Validation failed for ${invalidEdits.length} edit(s):\n${errors}`,
          data: { validationResults },
        };
      }

      // Apply edits in order
      const appliedEdits: EditResult[] = [];
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const lineNumber = this.findLineNumber(content, edit.old_string);

        // Check if old_string still exists (could have been affected by previous edit)
        if (!content.includes(edit.old_string)) {
          // Rollback all changes
          return {
            success: false,
            error: `Edit ${i + 1} failed: old_string not found (may have been modified by previous edit)\nold_string: "${this.truncate(edit.old_string, 50)}"`,
            data: {
              appliedEdits,
              failedAtIndex: i,
            },
          };
        }

        // Apply the edit
        content = content.replace(edit.old_string, edit.new_string);

        appliedEdits.push({
          index: i,
          old_string: edit.old_string,
          new_string: edit.new_string,
          line: lineNumber,
          success: true,
        });
      }

      // If dry run, don't write
      if (options.dryRun) {
        return {
          success: true,
          output: `Dry run successful. ${edits.length} edit(s) would be applied to ${relativePath}`,
          data: {
            dryRun: true,
            edits: appliedEdits,
            preview: this.generateDiff(originalContent, content),
          },
        };
      }

      // Write the modified content
      await fs.writeFile(resolvedPath, content, "utf-8");

      // Generate summary
      const summary = appliedEdits
        .map((e) => `  Line ${e.line}: "${this.truncate(e.old_string, 30)}" → "${this.truncate(e.new_string, 30)}"`)
        .join("\n");

      return {
        success: true,
        output: `Successfully applied ${edits.length} edit(s) to ${relativePath}:\n${summary}`,
        data: {
          edits: appliedEdits,
          file: relativePath,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `MultiEdit error: ${error.message}`,
      };
    }
  }

  /**
   * Validate all edits before applying
   */
  private validateEdits(content: string, edits: Edit[]): EditResult[] {
    const results: EditResult[] = [];
    let tempContent = content;

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];

      // Check for required fields
      if (typeof edit.old_string !== "string") {
        results.push({
          index: i,
          old_string: String(edit.old_string || ""),
          new_string: String(edit.new_string || ""),
          line: 0,
          success: false,
          error: "old_string is required and must be a string",
        });
        continue;
      }

      if (typeof edit.new_string !== "string") {
        results.push({
          index: i,
          old_string: edit.old_string,
          new_string: String(edit.new_string || ""),
          line: 0,
          success: false,
          error: "new_string is required and must be a string",
        });
        continue;
      }

      // Check if old_string is empty
      if (edit.old_string === "") {
        results.push({
          index: i,
          old_string: edit.old_string,
          new_string: edit.new_string,
          line: 0,
          success: false,
          error: "old_string cannot be empty",
        });
        continue;
      }

      // Check if old_string exists in current content state
      if (!tempContent.includes(edit.old_string)) {
        results.push({
          index: i,
          old_string: edit.old_string,
          new_string: edit.new_string,
          line: 0,
          success: false,
          error: `old_string not found in file: "${this.truncate(edit.old_string, 50)}"`,
        });
        continue;
      }

      // Check for uniqueness (multiple occurrences)
      const occurrences = this.countOccurrences(tempContent, edit.old_string);
      if (occurrences > 1) {
        results.push({
          index: i,
          old_string: edit.old_string,
          new_string: edit.new_string,
          line: this.findLineNumber(tempContent, edit.old_string),
          success: false,
          error: `old_string appears ${occurrences} times. Provide more context to make it unique.`,
        });
        continue;
      }

      // Simulate the edit for next iteration
      const lineNumber = this.findLineNumber(tempContent, edit.old_string);
      tempContent = tempContent.replace(edit.old_string, edit.new_string);

      results.push({
        index: i,
        old_string: edit.old_string,
        new_string: edit.new_string,
        line: lineNumber,
        success: true,
      });
    }

    return results;
  }

  /**
   * Count occurrences of a string in content
   */
  private countOccurrences(content: string, searchStr: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = content.indexOf(searchStr, pos)) !== -1) {
      count++;
      pos += searchStr.length;
    }
    return count;
  }

  /**
   * Find line number where string first appears
   */
  private findLineNumber(content: string, searchStr: string): number {
    const index = content.indexOf(searchStr);
    if (index === -1) return 0;

    const beforeMatch = content.substring(0, index);
    return beforeMatch.split("\n").length;
  }

  /**
   * Truncate string for display
   */
  private truncate(str: string, maxLen: number): string {
    const singleLine = str.replace(/\n/g, "\\n").replace(/\t/g, "\\t");
    if (singleLine.length <= maxLen) return singleLine;
    return singleLine.substring(0, maxLen - 3) + "...";
  }

  /**
   * Generate a simple diff preview
   */
  private generateDiff(original: string, modified: string): string {
    const originalLines = original.split("\n");
    const modifiedLines = modified.split("\n");

    const diff: string[] = [];
    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const modLine = modifiedLines[i];

      if (origLine !== modLine) {
        if (origLine !== undefined) {
          diff.push(`- ${origLine}`);
        }
        if (modLine !== undefined) {
          diff.push(`+ ${modLine}`);
        }
      }
    }

    if (diff.length === 0) {
      return "(no changes)";
    }

    return diff.slice(0, 50).join("\n") + (diff.length > 50 ? "\n... (truncated)" : "");
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
