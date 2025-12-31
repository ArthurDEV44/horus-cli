/**
 * Init command for Horus CLI - Version simplifiée
 * Generates HORUS.md documentation file (~30 lines)
 */

import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { join } from "path";
import type { InitConfig } from "../init/types.js";
import { scanRepository } from "../init/scanner.js";
import { generateHorusMd, writeHorusMd } from "../init/generator.js";

/**
 * Creates the init command
 */
export function createInitCommand(): Command {
  const initCmd = new Command("init");

  initCmd
    .description("Generate HORUS.md documentation for AI assistants (~30 lines)")
    .option("-f, --force", "Force overwrite if file exists", false)
    .option("--no-git", "Skip git metadata extraction")
    .option("-o, --output <file>", "Output file name", "HORUS.md")
    .option("-v, --verbose", "Verbose output", false)
    .action(async (options) => {
      const cwd = process.cwd();

      // Build config
      const config: InitConfig = {
        targetFile: options.output,
        force: options.force,
        includeGit: options.git !== false,
        verbose: options.verbose,
        cwd,
      };

      // Check if file already exists
      const targetPath = join(cwd, config.targetFile);
      if (existsSync(targetPath) && !config.force) {
        console.log(chalk.yellow(`\n⚠️  ${config.targetFile} already exists.`));
        console.log(chalk.dim(`   Use --force to overwrite.\n`));
        process.exit(1);
      }

      try {
        // Step 1: Scan repository
        console.log(chalk.cyan("🔍 Scanning codebase..."));
        const scanResult = scanRepository(config);

        if (config.verbose) {
          console.log(chalk.dim(`   Project: ${scanResult.projectName}`));
          console.log(chalk.dim(`   TypeScript: ${scanResult.hasTypeScript}`));
          console.log(chalk.dim(`   ESM: ${scanResult.isESM}`));
          console.log(chalk.dim(`   Git branch: ${scanResult.gitBranch || "N/A"}`));
          console.log(chalk.dim(`   Key deps: ${scanResult.keyDependencies.join(", ") || "none"}`));
        }

        // Step 2: Generate content
        console.log(chalk.cyan("📝 Generating HORUS.md..."));
        const content = generateHorusMd(scanResult);

        // Step 3: Write file
        const result = writeHorusMd(content, cwd, config.targetFile);

        // Success message
        console.log(chalk.green(`\n✅ ${result.message}`));

        if (config.verbose) {
          console.log(chalk.dim(`   Path: ${result.filePath}`));
        }

        console.log("");

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n❌ Error: ${message}\n`));
        if (config.verbose && error instanceof Error && error.stack) {
          console.error(chalk.dim(error.stack));
        }
        process.exit(1);
      }
    });

  return initCmd;
}
