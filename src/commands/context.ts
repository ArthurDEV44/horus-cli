import { Command } from "commander";
import { ContextTelemetry } from "../utils/context-telemetry.js";
import { getContextCache } from "../context/cache.js";
import { ContextOrchestrator } from "../context/orchestrator.js";
import type { ContextRequest } from "../types/context.js";
import { getModelMaxContext } from "../horus/model-configs.js";
import { createTokenCounter } from "../utils/token-counter.js";
import { getSystemInfo, formatSystemInfo } from "../utils/system-info.js";
import { selectOptimalModel, selectModelByProfile, formatRecommendation, type ModelProfile } from "../horus/model-selector.js";
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

  // horus context plan
  contextCmd
    .command("plan")
    .description("Preview context gathering strategy for a query (dry-run)")
    .argument("<query>", "Query to plan for")
    .option("--model <model>", "Model to use for planning", "devstral:24b")
    .option("--json", "Output as JSON")
    .action(async (query: string, options) => {
      const orchestrator = new ContextOrchestrator({
        cacheEnabled: true,
        defaultContextPercent: 0.3,
        debug: false,
      });

      const maxContext = getModelMaxContext(options.model);
      const _tokenCounter = createTokenCounter(options.model);

      const contextRequest: ContextRequest = {
        intent: orchestrator.detectIntent(query),
        query,
        currentContext: [],
        budget: {
          maxTokens: maxContext,
          reservedForContext: 0.3,
          usedByHistory: 0,
          available: Math.floor(maxContext * 0.3),
        },
      };

      if (options.json) {
        console.log(JSON.stringify({
          query,
          intent: contextRequest.intent,
          budget: contextRequest.budget,
        }, null, 2));
        return;
      }

      console.log(chalk.bold.cyan("\n🗺️  Context Gathering Plan\n"));
      console.log(chalk.bold("Query:"));
      console.log(`  ${chalk.dim('"')}${query}${chalk.dim('"')}\n`);

      console.log(chalk.bold("Intent Detection:"));
      console.log(`  Detected: ${chalk.green(contextRequest.intent)}\n`);

      console.log(chalk.bold("Token Budget:"));
      console.log(`  Model:              ${chalk.cyan(options.model)}`);
      console.log(`  Max Context:        ${chalk.yellow(maxContext.toLocaleString())} tokens`);
      console.log(`  Reserved for Ctx:   ${chalk.yellow(contextRequest.budget.available.toLocaleString())} tokens (30%)`);
      console.log(`  Used by History:    ${chalk.dim(contextRequest.budget.usedByHistory.toLocaleString())} tokens\n`);

      console.log(chalk.bold("Strategy:"));
      console.log(`  ${chalk.cyan("agentic-search")} (keyword-based file discovery)\n`);

      console.log(chalk.dim("💡 Run with --json for machine-readable output\n"));
    });

  // horus context clear-cache
  contextCmd
    .command("clear-cache")
    .description("Clear the context cache")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (options) => {
      const cache = getContextCache();
      const stats = cache.getStats();

      if (!options.yes && stats.size > 0) {
        console.log(chalk.yellow(`⚠️  About to clear ${stats.size} cached entries`));
        console.log(chalk.dim(`   Tokens saved: ~${stats.tokensSaved.toLocaleString()}`));
        console.log(chalk.dim("   Use --yes to skip this confirmation\n"));

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

          cache.clear();
          console.log(chalk.green("✓ Context cache cleared"));
        });
      } else {
        cache.clear();
        console.log(chalk.green("✓ Context cache cleared"));
      }
    });

  // horus context stats
  contextCmd
    .command("stats")
    .description("Show detailed statistics and analysis")
    .option("-n, --last <number>", "Show last N operations")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const telemetry = ContextTelemetry.getInstance();
      const lastN = options.last ? parseInt(options.last, 10) : undefined;
      const snapshot = telemetry.getSnapshot(lastN);

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
          ...(lastN && { limitedTo: lastN }),
        };
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      // Detailed stats
      const title = lastN
        ? `📈 Detailed Telemetry Statistics (last ${lastN})`
        : "📈 Detailed Telemetry Statistics";
      console.log(chalk.bold.cyan(`\n${title}\n`));

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

  // horus context bench
  contextCmd
    .command("bench")
    .description("Benchmark and model recommendation")
    .option("-m, --model <name>", "Test specific model (optional)")
    .option("-p, --profile <profile>", "Test specific profile: fast|balanced|powerful|deep")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      console.log(chalk.bold.cyan("\n🏋️  System Benchmark & Model Recommendation\n"));

      // Get system info
      console.log(chalk.dim("Detecting system configuration..."));
      const sysInfo = await getSystemInfo();

      if (options.json) {
        const result = {
          system: sysInfo,
          recommendations: {
            fast: selectOptimalModel(4000, sysInfo.vram),
            balanced: selectOptimalModel(16000, sysInfo.vram),
            powerful: selectOptimalModel(28000, sysInfo.vram),
          },
        };
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Display system info
      console.log(chalk.bold("System Configuration:"));
      const formattedInfo = formatSystemInfo(sysInfo);
      formattedInfo.split("\n").forEach((line) => {
        console.log(`  ${chalk.dim(line)}`);
      });
      console.log();

      // Model recommendation based on profile or automatic
      if (options.profile) {
        const profile = options.profile as ModelProfile;
        console.log(chalk.bold(`Model Recommendation (Profile: ${chalk.cyan(profile)}):\n`));
        try {
          const recommendation = selectModelByProfile(profile, sysInfo.vram);
          console.log(formatRecommendation(recommendation).split("\n").map((line) => `  ${line}`).join("\n"));
        } catch (error) {
          console.log(chalk.red(`  ✗ ${error.message}`));
        }
      } else {
        // Show recommendations for different context sizes
        console.log(chalk.bold("Model Recommendations by Context Size:\n"));

        const scenarios = [
          { name: "Small Context (4K tokens)", contextSize: 4000 },
          { name: "Medium Context (16K tokens)", contextSize: 16000 },
          { name: "Large Context (28K tokens)", contextSize: 28000 },
        ];

        for (const scenario of scenarios) {
          console.log(chalk.bold.yellow(`${scenario.name}:`));
          try {
            const recommendation = selectOptimalModel(scenario.contextSize, sysInfo.vram);
            console.log(`  Model: ${chalk.cyan(recommendation.modelName)} (${recommendation.profile})`);
            console.log(`  Reason: ${chalk.dim(recommendation.reason)}`);
          } catch (error) {
            console.log(chalk.red(`  ✗ ${error.message}`));
          }
          console.log();
        }
      }

      // Recommendations
      console.log(chalk.bold("💡 Recommendations:\n"));

      if (sysInfo.vram >= 32) {
        console.log(chalk.green("  ✓ Your system can run all models including devstral:24b (128K context)"));
        console.log(chalk.dim("  ✓ Recommended: Use devstral:24b for long coding sessions"));
      } else if (sysInfo.vram >= 24) {
        console.log(chalk.green("  ✓ Your system can run mixtral (8x7B) for complex tasks"));
        console.log(chalk.dim("  ✓ Recommended: Use mixtral for refactoring, mistral-small for most tasks"));
      } else if (sysInfo.vram >= 12) {
        console.log(chalk.yellow("  ⚡ Recommended: mistral-small (22B) - Best balance for your system"));
        console.log(chalk.dim("  ℹ️  Use mistral (7B) for faster responses when needed"));
      } else {
        console.log(chalk.yellow("  ⚡ Recommended: mistral (7B) - Fast and efficient"));
        console.log(chalk.dim("  ⚠️  Consider upgrading VRAM for larger models"));
      }

      console.log();
    });

  return contextCmd;
}
