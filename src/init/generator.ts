/**
 * Generator module for /init command - Version simplifiée
 * Generates a concise HORUS.md file (~30 lines)
 */

import type { ScanResult, InitResult } from "./types.js";
import { writeFileSync } from "fs";
import { join } from "path";

// ============================================================================
// Template HORUS.md (~30 lignes)
// ============================================================================

const HORUS_TEMPLATE = `# HORUS.md

## Build & Dev Commands

{COMMANDS}

## Code Style

{CODE_STYLE}

## Architecture

{ARCHITECTURE}

## Key Patterns

{PATTERNS}
`;

// ============================================================================
// Generator principal
// ============================================================================

/**
 * Generates HORUS.md content from scan result
 */
export function generateHorusMd(scan: ScanResult): string {
  // Commands section
  const commands = generateCommandsSection(scan);

  // Code style section
  const codeStyle = generateCodeStyleSection(scan);

  // Architecture section (simple)
  const architecture = generateArchitectureSection(scan);

  // Patterns section
  const patterns = generatePatternsSection(scan);

  // Replace placeholders
  return HORUS_TEMPLATE
    .replace("{COMMANDS}", commands)
    .replace("{CODE_STYLE}", codeStyle)
    .replace("{ARCHITECTURE}", architecture)
    .replace("{PATTERNS}", patterns);
}

/**
 * Generates the commands section
 */
function generateCommandsSection(scan: ScanResult): string {
  const lines: string[] = [];

  if (scan.scripts.install) {
    lines.push(`${scan.scripts.install.padEnd(25)} # Install dependencies`);
  }
  if (scan.scripts.dev) {
    lines.push(`${scan.scripts.dev.padEnd(25)} # Dev mode with hot reload`);
  }
  if (scan.scripts.build) {
    lines.push(`${scan.scripts.build.padEnd(25)} # Build for production`);
  }
  if (scan.scripts.test) {
    lines.push(`${scan.scripts.test.padEnd(25)} # Run tests`);
  }
  if (scan.scripts.lint) {
    lines.push(`${scan.scripts.lint.padEnd(25)} # Run linter`);
  }

  return lines.join("\n");
}

/**
 * Generates the code style section
 */
function generateCodeStyleSection(scan: ScanResult): string {
  const lines: string[] = [];

  if (scan.isESM) {
    lines.push('- ESM imports with .js extension: `import { X } from "./module.js"`');
  } else {
    lines.push("- CommonJS: `const X = require('./module')`");
  }

  if (scan.hasTypeScript) {
    lines.push("- Files: kebab-case.ts, Classes: PascalCase");
    if (scan.strictMode) {
      lines.push("- TypeScript strict mode enabled");
    }
  }

  lines.push("- Use async/await over promise chains");

  return lines.join("\n");
}

/**
 * Generates the architecture section
 */
function generateArchitectureSection(scan: ScanResult): string {
  const deps = scan.keyDependencies;

  // Détecter le type de projet basé sur les dépendances
  if (deps.includes("ink") || deps.includes("commander")) {
    return "CLI application with agent-based architecture.\nSee src/ for main modules.";
  }
  if (deps.includes("react") || deps.includes("next")) {
    return "React-based application.\nSee src/components/ for UI components.";
  }
  if (deps.includes("express") || deps.includes("fastify")) {
    return "Web server application.\nSee src/routes/ for API endpoints.";
  }

  return "See src/ for main source code.";
}

/**
 * Generates the patterns section
 */
function generatePatternsSection(scan: ScanResult): string {
  const lines: string[] = [];

  if (scan.hasTypeScript) {
    lines.push("- Types in src/types/ or inline");
  }

  if (scan.keyDependencies.length > 0) {
    const deps = scan.keyDependencies.slice(0, 3).join(", ");
    lines.push(`- Key deps: ${deps}`);
  }

  if (scan.scripts.test) {
    lines.push("- Tests: see tests/ or *.spec.ts files");
  }

  return lines.length > 0 ? lines.join("\n") : "- See source code for patterns";
}

// ============================================================================
// Write to file
// ============================================================================

/**
 * Writes HORUS.md to disk
 */
export function writeHorusMd(
  content: string,
  cwd: string,
  targetFile: string
): InitResult {
  const filePath = join(cwd, targetFile);
  const linesWritten = content.split("\n").length;

  writeFileSync(filePath, content, "utf-8");

  return {
    created: true,
    filePath,
    linesWritten,
    message: `Created ${targetFile} (${linesWritten} lines)`,
  };
}
