import { Command } from "commander";
import { ContextTelemetry } from "../utils/context-telemetry.js";
import * as fs from "fs-extra";
import * as path from "path";
import chalk from "chalk";

/**
 * Context management commands
 * Provides CLI interface for telemetry inspection and management
 */
export function createContextCommand(): Command {
  const contextCmd = new Command("context");
  contextCmd.description("Manage and inspect context telemetry");

  // horus context status
  contextCmd
    .command("status")
    .description("Show current telemetry status and recent operations")
    .option("-n, --last <number>", "Show last N operations", "10")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const telemetry = ContextTelemetry.getInstance();
      const lastN = parseInt(options.last, 10);
      const snapshot = telemetry.getSnapshot(lastN);

      if (options.json) {
        console.log(JSON.stringify(snapshot, null, 2));
        return;
      }

      // Pretty print status
      console.log(chalk.bold.cyan("\n📊 Context Telemetry Status\n"));

      console.log(chalk.bold("Overview:"));
      console.log(`  Total Operations: ${chalk.green(snapshot.totalOperations)}`);
      console.log(`  Avg Tokens/Op:    ${chalk.yellow(snapshot.avgTokensPerOperation)}`);
      console.log(`  Avg Duration:     ${chalk.yellow(snapshot.avgDuration)}ms`);
      console.log(`  Cache Hit Rate:   ${chalk.cyan((snapshot.cacheHitRate * 100).toFixed(1))}%`);

      console.log(chalk.bold("\nOperation Breakdown:"));
      Object.entries(snapshot.operationBreakdown).forEach(([op, count]) => {
        const emoji = { search: "🔍", view: "👁️", edit: "✏️", create: "📝" }[op] || "•";
        console.log(`  ${emoji} ${op.padEnd(10)} ${chalk.green(count)}`);
      });

      if (snapshot.recentOperations.length > 0) {
        console.log(chalk.bold(`\nRecent Operations (last ${lastN}):`));
        snapshot.recentOperations.forEach((metric, idx) => {
          const emoji = { search: "🔍", view: "👁️", edit: "✏️", create: "📝" }[metric.operation] || "•";
          const cacheIndicator = metric.cacheHit ? chalk.green(" [cached]") : "";
          console.log(
            `  ${idx + 1}. ${emoji} ${metric.operation} | ` +
            `${metric.duration}ms | ` +
            `~${metric.tokensEstimated} tokens` +
            cacheIndicator
          );
        });
      }

      console.log(); // Empty line at end
    });

  // horus context export
  contextCmd
    .command("export")
    .description("Export telemetry data to JSON file")
    .argument("[filepath]", "Output file path", "telemetry-export.json")
    .action(async (filepath: string) => {
      const telemetry = ContextTelemetry.getInstance();
      const resolvedPath = path.resolve(filepath);

      try {
        telemetry.exportToJSON(resolvedPath);
        console.log(chalk.green(`✓ Telemetry exported to: ${resolvedPath}`));

        const stats = await fs.stat(resolvedPath);
        console.log(chalk.dim(`  File size: ${(stats.size / 1024).toFixed(2)} KB`));
      } catch (error: any) {
        console.error(chalk.red(`✗ Export failed: ${error.message}`));
        process.exit(1);
      }
    });

  // horus context clear
  contextCmd
    .command("clear")
    .description("Clear all telemetry data")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (options) => {
      const telemetry = ContextTelemetry.getInstance();
      const snapshot = telemetry.getSnapshot();

      if (!options.yes && snapshot.totalOperations > 0) {
        console.log(chalk.yellow(`⚠️  About to clear ${snapshot.totalOperations} telemetry records`));
        console.log(chalk.dim("   Use --yes to skip this confirmation\n"));

        // Simple confirmation without readline
        const { default: readline } = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question("Continue? (y/N) ", (answer) => {
          rl.close();
          if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
            console.log(chalk.dim("Cancelled"));
            return;
          }

          telemetry.clear();
          console.log(chalk.green("✓ Telemetry cleared"));
        });
      } else {
        telemetry.clear();
        console.log(chalk.green("✓ Telemetry cleared"));
      }
    });

  // horus context stats
  contextCmd
    .command("stats")
    .description("Show detailed statistics and analysis")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const telemetry = ContextTelemetry.getInstance();
      const snapshot = telemetry.getSnapshot();

      if (snapshot.totalOperations === 0) {
        console.log(chalk.yellow("⚠️  No telemetry data available"));
        console.log(chalk.dim("   Run some operations first to collect data"));
        return;
      }

      if (options.json) {
        const stats = {
          snapshot,
          analysis: {
            totalTokens: snapshot.totalOperations * snapshot.avgTokensPerOperation,
            totalDuration: snapshot.totalOperations * snapshot.avgDuration,
          },
        };
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      // Detailed stats
      console.log(chalk.bold.cyan("\n📈 Detailed Telemetry Statistics\n"));

      console.log(chalk.bold("Performance Metrics:"));
      console.log(`  Total Operations:     ${chalk.green(snapshot.totalOperations)}`);
      console.log(`  Total Tokens (est.):  ${chalk.yellow(snapshot.totalOperations * snapshot.avgTokensPerOperation)}`);
      console.log(`  Total Duration:       ${chalk.yellow(snapshot.totalOperations * snapshot.avgDuration)}ms`);
      console.log(`  Avg Tokens/Op:        ${chalk.cyan(snapshot.avgTokensPerOperation)}`);
      console.log(`  Avg Duration/Op:      ${chalk.cyan(snapshot.avgDuration)}ms`);

      if (Object.keys(snapshot.operationBreakdown).length > 0) {
        console.log(chalk.bold("\nOperation Distribution:"));
        Object.entries(snapshot.operationBreakdown).forEach(([op, count]) => {
          const percentage = ((count / snapshot.totalOperations) * 100).toFixed(1);
          const emoji = { search: "🔍", view: "👁️", edit: "✏️", create: "📝" }[op] || "•";
          const bar = "█".repeat(Math.round(parseFloat(percentage) / 2));
          console.log(`  ${emoji} ${op.padEnd(10)} ${chalk.green(count.toString().padStart(4))} (${percentage.padStart(5)}%) ${chalk.dim(bar)}`);
        });
      }

      console.log(chalk.bold("\nCache Performance:"));
      const cacheHitRate = snapshot.cacheHitRate * 100;
      const cacheColor = cacheHitRate > 50 ? chalk.green : cacheHitRate > 20 ? chalk.yellow : chalk.red;
      console.log(`  Cache Hit Rate:       ${cacheColor(cacheHitRate.toFixed(1) + "%")}`);

      console.log(); // Empty line at end
    });

  return contextCmd;
}
