/**
 * SnippetBuilder - Structural compression for code files
 *
 * Purpose:
 * - Reduce token count by extracting important declarations
 * - No LLM calls (too expensive for local)
 * - Preserve exports, functions, classes, types, interfaces
 * - Omit implementation details
 *
 * Strategy:
 * - Extract first N important lines (exports, functions, etc.)
 * - If too many, show header + footer with "... omitted" in middle
 * - Add file metadata (path, total lines, total declarations)
 *
 * Target: 60-80% token reduction vs full files
 */

import fs from 'fs-extra';
import path from 'path';
import { createTokenCounter } from '../utils/token-counter.js';

// ============================================================================
// Types
// ============================================================================

export interface SnippetOptions {
  maxLines?: number;           // Max lines in snippet (default: 30)
  includeImports?: boolean;    // Include import statements (default: false)
  includeComments?: boolean;   // Include JSDoc comments (default: true)
}

export interface CodeSnippet {
  filePath: string;
  snippet: string;
  metadata: {
    totalLines: number;
    totalDeclarations: number;
    includedDeclarations: number;
    omittedDeclarations: number;
    tokens: number;
    compressionRatio: number; // tokens_snippet / tokens_full
  };
}

// ============================================================================
// SnippetBuilder Class
// ============================================================================

export class SnippetBuilder {
  private tokenCounter: ReturnType<typeof createTokenCounter>;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.tokenCounter = createTokenCounter();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Build snippet from file
   */
  buildSnippet(
    filePath: string,
    options: SnippetOptions = {}
  ): CodeSnippet {
    const maxLines = options.maxLines ?? 30;
    const includeImports = options.includeImports ?? false;
    const includeComments = options.includeComments ?? true;

    try {
      const fullPath = this.resolveFilePath(filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Extract important lines
      const important = this.extractImportantLines(
        lines,
        includeImports,
        includeComments
      );

      // Build snippet
      const snippet = this.buildSnippetContent(
        filePath,
        important,
        maxLines
      );

      // Calculate metadata
      const tokensOriginal = this.tokenCounter.countTokens(content);
      const tokensSnippet = this.tokenCounter.countTokens(snippet);
      const compressionRatio = tokensSnippet / tokensOriginal;

      return {
        filePath,
        snippet,
        metadata: {
          totalLines: lines.length,
          totalDeclarations: important.length,
          includedDeclarations: Math.min(important.length, maxLines),
          omittedDeclarations: Math.max(0, important.length - maxLines),
          tokens: tokensSnippet,
          compressionRatio,
        },
      };
    } catch (error) {
      // File not readable
      return this.errorSnippet(filePath, error);
    }
  }

  /**
   * Build snippets for multiple files
   */
  buildSnippets(
    filePaths: string[],
    options: SnippetOptions = {}
  ): CodeSnippet[] {
    return filePaths.map((fp) => this.buildSnippet(fp, options));
  }

  // ==========================================================================
  // Line Extraction
  // ==========================================================================

  /**
   * Extract important lines (exports, functions, classes, types, etc.)
   */
  private extractImportantLines(
    lines: string[],
    includeImports: boolean,
    includeComments: boolean
  ): string[] {
    const important: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // JSDoc comments (multi-line)
      if (includeComments && trimmed.startsWith('/**')) {
        const commentLines = this.extractJSDocComment(lines, i);
        important.push(...commentLines);
        i += commentLines.length - 1; // Skip already processed lines
        continue;
      }

      // Import/require statements
      if (includeImports && this.isImportLine(trimmed)) {
        important.push(line);
        continue;
      }

      // Export declarations
      if (this.isExportLine(trimmed)) {
        important.push(line);
        continue;
      }

      // Function declarations
      if (this.isFunctionLine(trimmed)) {
        important.push(line);
        continue;
      }

      // Class declarations
      if (this.isClassLine(trimmed)) {
        important.push(line);
        continue;
      }

      // Interface/Type declarations
      if (this.isTypeDeclaration(trimmed)) {
        important.push(line);
        continue;
      }

      // Const/let/var declarations (top-level only)
      if (this.isVariableDeclaration(trimmed)) {
        important.push(line);
        continue;
      }
    }

    return important;
  }

  /**
   * Extract JSDoc comment block
   */
  private extractJSDocComment(lines: string[], startIndex: number): string[] {
    const comment: string[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      comment.push(line);

      if (line.trim().endsWith('*/')) {
        break;
      }
    }

    return comment;
  }

  // ==========================================================================
  // Line Type Detection
  // ==========================================================================

  private isImportLine(line: string): boolean {
    return (
      line.startsWith('import ') ||
      line.startsWith('export ') && line.includes('from') ||
      /require\(['"]/.test(line)
    );
  }

  private isExportLine(line: string): boolean {
    return (
      line.startsWith('export ') ||
      line.startsWith('module.exports') ||
      line.startsWith('exports.')
    );
  }

  private isFunctionLine(line: string): boolean {
    return (
      line.startsWith('function ') ||
      line.startsWith('async function ') ||
      /^(export\s+)?(async\s+)?function\s+/.test(line)
    );
  }

  private isClassLine(line: string): boolean {
    return (
      line.startsWith('class ') ||
      /^(export\s+)?(abstract\s+)?class\s+/.test(line)
    );
  }

  private isTypeDeclaration(line: string): boolean {
    return (
      line.startsWith('interface ') ||
      line.startsWith('type ') ||
      line.startsWith('enum ') ||
      /^(export\s+)?(interface|type|enum)\s+/.test(line)
    );
  }

  private isVariableDeclaration(line: string): boolean {
    return (
      line.startsWith('const ') ||
      line.startsWith('let ') ||
      line.startsWith('var ') ||
      /^(export\s+)?(const|let|var)\s+/.test(line)
    );
  }

  // ==========================================================================
  // Snippet Building
  // ==========================================================================

  /**
   * Build snippet content with header/footer
   */
  private buildSnippetContent(
    filePath: string,
    importantLines: string[],
    maxLines: number
  ): string {
    const lines = importantLines;

    if (lines.length <= maxLines) {
      // All lines fit
      return this.formatSnippet(filePath, lines, 0);
    }

    // Too many lines: show header + footer with "... omitted"
    const headerCount = Math.floor(maxLines / 2);
    const footerCount = maxLines - headerCount;

    const header = lines.slice(0, headerCount);
    const footer = lines.slice(-footerCount);
    const omitted = lines.length - (headerCount + footerCount);

    return this.formatSnippet(filePath, header, omitted, footer);
  }

  /**
   * Format snippet with metadata header
   */
  private formatSnippet(
    filePath: string,
    header: string[],
    omitted: number = 0,
    footer: string[] = []
  ): string {
    const parts: string[] = [];

    // Header comment
    parts.push(`// ${filePath}`);
    if (omitted > 0) {
      parts.push(`// (${header.length + footer.length} declarations shown, ${omitted} omitted)`);
    } else {
      parts.push(`// (${header.length} declarations)`);
    }

    parts.push('');

    // Header lines
    parts.push(...header);

    // Omitted section
    if (omitted > 0) {
      parts.push('');
      parts.push(`// ... (${omitted} more declarations omitted)`);
      parts.push('');
    }

    // Footer lines
    if (footer.length > 0) {
      parts.push(...footer);
    }

    return parts.join('\n').trim();
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Resolve file path (relative to cwd)
   */
  private resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    return path.join(this.cwd, filePath);
  }

  /**
   * Error snippet when file not readable
   */
  private errorSnippet(filePath: string, error: any): CodeSnippet {
    return {
      filePath,
      snippet: `// ${filePath}\n// (unable to read file: ${error.message})`,
      metadata: {
        totalLines: 0,
        totalDeclarations: 0,
        includedDeclarations: 0,
        omittedDeclarations: 0,
        tokens: 0,
        compressionRatio: 0,
      },
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Convenience function for building a single snippet
 */
export function buildSnippet(
  filePath: string,
  options?: SnippetOptions
): CodeSnippet {
  const builder = new SnippetBuilder();
  return builder.buildSnippet(filePath, options);
}

/**
 * Convenience function for building multiple snippets
 */
export function buildSnippets(
  filePaths: string[],
  options?: SnippetOptions
): CodeSnippet[] {
  const builder = new SnippetBuilder();
  return builder.buildSnippets(filePaths, options);
}
