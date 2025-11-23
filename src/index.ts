#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { program } from "commander";
import * as dotenv from "dotenv";
import { HorusAgent } from "./agent/horus-agent.js";
import ModernChatInterface from "./ui/components/modern-chat-interface.js";
import { getSettingsManager } from "./utils/settings-manager.js";
import { ConfirmationService } from "./utils/confirmation-service.js";
import { createMCPCommand } from "./commands/mcp.js";
import { createContextCommand } from "./commands/context.js";
import { getRecommendedModel } from "./horus/model-selector.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat";

// Load environment variables
dotenv.config();

// Disable default SIGINT handling to let Ink handle Ctrl+C
// We'll handle exit through the input system instead

// Ensure stdin is properly configured for interactive use
function ensureStdinReady(): void {
  if (!process.stdin.isTTY) {
    console.error("Error: This application requires an interactive terminal (TTY).");
    console.error("Please run this command in an interactive shell, not in a pipe or redirect.");
    process.exit(1);
  }

  // Configure stdin before Ink starts
  try {
    // Set encoding
    process.stdin.setEncoding('utf8');

    // Remove all existing listeners to avoid conflicts with Ink
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('error');
    process.stdin.removeAllListeners('keypress');

    // Add error handler for stdin that won't interfere with Ink
    process.stdin.on('error', (error: any) => {
      if (error.code === 'EPERM' || error.code === 'EBADF') {
        // Silently ignore these errors in WSL2
        if (process.env.DEBUG) {
          console.error('DEBUG - Stdin error ignored:', error.code);
        }
        return;
      }
      if (process.env.DEBUG) {
        console.error('Stdin error:', error);
      }
    });

    // Resume stdin if it's paused
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }

    // DO NOT set raw mode here - let Ink handle it completely
    // Setting raw mode here causes issues in WSL2
  } catch (error: any) {
    // In WSL2, we might get EPERM errors that we can safely ignore
    if (error.code !== 'EPERM' && error.code !== 'EBADF') {
      console.error("Error: Failed to configure terminal input.");
      console.error("This may be a WSL2/terminal compatibility issue.");
      console.error(`Details: ${error.message}`);
      process.exit(1);
    }
  }
}

process.on("SIGTERM", () => {
  // Restore terminal to normal mode before exit
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    try {
      process.stdin.setRawMode(false);
    } catch (e) {
      // Ignore errors when setting raw mode
    }
  }
  console.log("\nGracefully shutting down...");
  process.exit(0);
});

// Handle uncaught exceptions to prevent hanging
process.on("uncaughtException", (error: any) => {
  // Debug mode - show all errors if DEBUG env is set
  if (process.env.DEBUG) {
    console.error("DEBUG - Uncaught exception:", error);
    console.error("DEBUG - Error details:", {
      code: error.code,
      syscall: error.syscall,
      fd: error.fd,
      errno: error.errno
    });
  }

  // Silently ignore EPERM errors from stdin read operations in WSL2
  if (error.code === 'EPERM' && error.syscall === 'read' && error.fd === 0) {
    // This is a known issue with WSL2 and Ink - ignore it
    if (process.env.DEBUG) {
      console.error("DEBUG - EPERM error ignored");
    }
    return;
  }

  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Ensure user settings are initialized
function ensureUserSettingsDirectory(): void {
  try {
    const manager = getSettingsManager();
    // This will create default settings if they don't exist
    manager.loadUserSettings();
  } catch (error) {
    // Silently ignore errors during setup
  }
}

// Load API key from user settings if not in environment
function loadApiKey(): string | undefined {
  const manager = getSettingsManager();
  return manager.getApiKey();
}

// Load base URL from user settings if not in environment
function loadBaseURL(): string {
  const manager = getSettingsManager();
  return manager.getBaseURL();
}

// Save command line settings to user settings file
async function saveCommandLineSettings(
  apiKey?: string,
  baseURL?: string
): Promise<void> {
  try {
    const manager = getSettingsManager();

    // Update with command line values
    if (apiKey) {
      manager.updateUserSetting("apiKey", apiKey);
      console.log("✅ API key saved to ~/.horus/user-settings.json");
    }
    if (baseURL) {
      manager.updateUserSetting("baseURL", baseURL);
      console.log("✅ Base URL saved to ~/.horus/user-settings.json");
    }
  } catch (error) {
    console.warn(
      "⚠️ Could not save settings to file:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Load model from user settings if not in environment
function loadModel(): string | undefined {
  // First check environment variables
  let model = process.env.HORUS_MODEL;

  if (!model) {
    // Use the unified model loading from settings manager
    try {
      const manager = getSettingsManager();
      model = manager.getCurrentModel();
    } catch (error) {
      // Ignore errors, model will remain undefined
    }
  }

  return model;
}

// Handle commit-and-push command in headless mode
async function handleCommitAndPushHeadless(
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
): Promise<void> {
  try {
    const agent = new HorusAgent(apiKey, baseURL, model, maxToolRounds);

    // Configure confirmation service for headless mode (auto-approve all operations)
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.setSessionFlag("allOperations", true);

    console.log("🤖 Processing commit and push...\n");
    console.log("> /commit-and-push\n");

    // First check if there are any changes at all
    const initialStatusResult = await agent.executeBashCommand(
      "git status --porcelain"
    );

    if (!initialStatusResult.success || !initialStatusResult.output?.trim()) {
      console.log("❌ No changes to commit. Working directory is clean.");
      process.exit(1);
    }

    console.log("✅ git status: Changes detected");

    // Add all changes
    const addResult = await agent.executeBashCommand("git add .");

    if (!addResult.success) {
      console.log(
        `❌ git add: ${addResult.error || "Failed to stage changes"}`
      );
      process.exit(1);
    }

    console.log("✅ git add: Changes staged");

    // Get staged changes for commit message generation
    const diffResult = await agent.executeBashCommand("git diff --cached");

    // Generate commit message using AI
    const commitPrompt = `Generate a concise, professional git commit message for these changes:

Git Status:
${initialStatusResult.output}

Git Diff (staged changes):
${diffResult.output || "No staged changes shown"}

Follow conventional commit format (feat:, fix:, docs:, etc.) and keep it under 72 characters.
Respond with ONLY the commit message, no additional text.`;

    console.log("🤖 Generating commit message...");

    const commitMessageEntries = await agent.processUserMessage(commitPrompt);
    let commitMessage = "";

    // Extract the commit message from the AI response
    for (const entry of commitMessageEntries) {
      if (entry.type === "assistant" && entry.content.trim()) {
        commitMessage = entry.content.trim();
        break;
      }
    }

    if (!commitMessage) {
      console.log("❌ Failed to generate commit message");
      process.exit(1);
    }

    // Clean the commit message
    const cleanCommitMessage = commitMessage.replace(/^["']|["']$/g, "");
    console.log(`✅ Generated commit message: "${cleanCommitMessage}"`);

    // Execute the commit
    const commitCommand = `git commit -m "${cleanCommitMessage}"`;
    const commitResult = await agent.executeBashCommand(commitCommand);

    if (commitResult.success) {
      console.log(
        `✅ git commit: ${
          commitResult.output?.split("\n")[0] || "Commit successful"
        }`
      );

      // If commit was successful, push to remote
      // First try regular push, if it fails try with upstream setup
      let pushResult = await agent.executeBashCommand("git push");

      if (
        !pushResult.success &&
        pushResult.error?.includes("no upstream branch")
      ) {
        console.log("🔄 Setting upstream and pushing...");
        pushResult = await agent.executeBashCommand("git push -u origin HEAD");
      }

      if (pushResult.success) {
        console.log(
          `✅ git push: ${
            pushResult.output?.split("\n")[0] || "Push successful"
          }`
        );
      } else {
        console.log(`❌ git push: ${pushResult.error || "Push failed"}`);
        process.exit(1);
      }
    } else {
      console.log(`❌ git commit: ${commitResult.error || "Commit failed"}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Error during commit and push:", error.message);
    process.exit(1);
  }
}

// Headless mode processing function
async function processPromptHeadless(
  prompt: string,
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
): Promise<void> {
  try {
    const agent = new HorusAgent(apiKey, baseURL, model, maxToolRounds);

    // Configure confirmation service for headless mode (auto-approve all operations)
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.setSessionFlag("allOperations", true);

    // Process the user message
    const chatEntries = await agent.processUserMessage(prompt);

    // Convert chat entries to OpenAI compatible message objects
    const messages: ChatCompletionMessageParam[] = [];

    for (const entry of chatEntries) {
      switch (entry.type) {
        case "user":
          messages.push({
            role: "user",
            content: entry.content,
          });
          break;

        case "assistant":
          const assistantMessage: ChatCompletionMessageParam = {
            role: "assistant",
            content: entry.content,
          };

          // Add tool calls if present
          if (entry.toolCalls && entry.toolCalls.length > 0) {
            assistantMessage.tool_calls = entry.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            }));
          }

          messages.push(assistantMessage);
          break;

        case "tool_result":
          if (entry.toolCall) {
            messages.push({
              role: "tool",
              tool_call_id: entry.toolCall.id,
              content: entry.content,
            });
          }
          break;
      }
    }

    // Output each message as a separate JSON object
    for (const message of messages) {
      console.log(JSON.stringify(message));
    }
  } catch (error: any) {
    // Output error in OpenAI compatible format
    console.log(
      JSON.stringify({
        role: "assistant",
        content: `Error: ${error.message}`,
      })
    );
    process.exit(1);
  }
}

program
  .name("horus")
  .description(
    "A conversational AI CLI tool powered by Horus with text editor capabilities"
  )
  .version("1.0.1")
  .argument("[message...]", "Initial message to send to Horus")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .option("-k, --api-key <key>", "Horus API key (or set HORUS_API_KEY env var)")
  .option(
    "-u, --base-url <url>",
    "Horus API base URL (or set HORUS_BASE_URL env var)"
  )
  .option(
    "-m, --model <model>",
    "AI model to use (e.g., devstral:24b, deepseek-coder-v2:16b) (or set HORUS_MODEL env var)"
  )
  .option(
    "-p, --prompt <prompt>",
    "process a single prompt and exit (headless mode)"
  )
  .option(
    "--max-tool-rounds <rounds>",
    "maximum number of tool execution rounds (default: 400)",
    "400"
  )
  .option(
    "--context-debug",
    "enable context telemetry debug logging (sets HORUS_CONTEXT_DEBUG=true)"
  )
  .action(async (message, options) => {
    // Enable context debug mode if flag is set
    if (options.contextDebug) {
      process.env.HORUS_CONTEXT_DEBUG = "true";
    }
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: any) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          error.message
        );
        process.exit(1);
      }
    }

    try {
      // Get API key from options, environment, or user settings
      // Note: Ollama doesn't require an API key, so it's optional now
      const apiKey = options.apiKey || loadApiKey() || "";
      const baseURL = options.baseUrl || loadBaseURL();
      const model = options.model || loadModel();
      const maxToolRounds = parseInt(options.maxToolRounds) || 400;

      // Phase 5: Show model recommendation hint if using default
      if (!options.model && process.env.HORUS_CONTEXT_DEBUG === 'true') {
        try {
          const recommendation = await getRecommendedModel(16384);
          if (recommendation.modelName !== model) {
            console.error(`[MODEL-SELECTOR] Recommended model: ${recommendation.modelName} (reason: ${recommendation.reason})`);
            console.error(`[MODEL-SELECTOR] Current model: ${model}. Use --model ${recommendation.modelName} or run 'horus context bench' for details`);
          }
        } catch {
          // Silently ignore recommendation errors
        }
      }

      // Save API key and base URL to user settings if provided via command line
      if (options.apiKey || options.baseUrl) {
        await saveCommandLineSettings(options.apiKey, options.baseUrl);
      }

      // Headless mode: process prompt and exit
      if (options.prompt) {
        await processPromptHeadless(
          options.prompt,
          apiKey,
          baseURL,
          model,
          maxToolRounds
        );
        return;
      }

      // Interactive mode: launch UI
      const agent = new HorusAgent(apiKey, baseURL, model, maxToolRounds);
      console.log("🤖 Starting Horus CLI Conversational Assistant...\n");

      ensureUserSettingsDirectory();

      // Support variadic positional arguments for multi-word initial message
      const initialMessage = Array.isArray(message)
        ? message.join(" ")
        : message;

      // Render with simple call - Ink 6.x handles WSL2 properly
      render(React.createElement(ModernChatInterface, { agent, initialMessage }));
    } catch (error: any) {
      console.error("❌ Error initializing Horus CLI:", error.message);
      process.exit(1);
    }
  });

// Git subcommand
const gitCommand = program
  .command("git")
  .description("Git operations with AI assistance");

gitCommand
  .command("commit-and-push")
  .description("Generate AI commit message and push to remote")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .option("-k, --api-key <key>", "Horus API key (or set HORUS_API_KEY env var)")
  .option(
    "-u, --base-url <url>",
    "Horus API base URL (or set HORUS_BASE_URL env var)"
  )
  .option(
    "-m, --model <model>",
    "AI model to use (e.g., devstral:24b, deepseek-coder-v2:16b) (or set HORUS_MODEL env var)"
  )
  .option(
    "--max-tool-rounds <rounds>",
    "maximum number of tool execution rounds (default: 400)",
    "400"
  )
  .action(async (options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: any) {
        console.error(
          `Error changing directory to ${options.directory}:`,
          error.message
        );
        process.exit(1);
      }
    }

    try {
      // Get API key from options, environment, or user settings
      // Note: Ollama doesn't require an API key, so it's optional now
      const apiKey = options.apiKey || loadApiKey() || "";
      const baseURL = options.baseUrl || loadBaseURL();
      const model = options.model || loadModel();
      const maxToolRounds = parseInt(options.maxToolRounds) || 400;

      // Save API key and base URL to user settings if provided via command line
      if (options.apiKey || options.baseUrl) {
        await saveCommandLineSettings(options.apiKey, options.baseUrl);
      }

      await handleCommitAndPushHeadless(apiKey, baseURL, model, maxToolRounds);
    } catch (error: any) {
      console.error("❌ Error during git commit-and-push:", error.message);
      process.exit(1);
    }
  });

// MCP command
program.addCommand(createMCPCommand());

// Context command
program.addCommand(createContextCommand());

program.parse();
