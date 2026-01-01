/**
 * Built-in Slash Commands
 *
 * Core commands that are always available in Horus CLI.
 */

import { registerBuiltinCommand } from '../registry.js';
import type { SlashCommand, CommandContext, CommandResult } from '../types.js';
import type { ChatEntry } from '../../../agent/horus-agent.js';
import { getCommandSuggestions, getCommandCounts } from '../registry.js';
import { getCommandDirectoriesStatus, createCommandTemplate } from '../loader.js';
import { loadModelConfig, updateCurrentModel } from '../../../utils/model-config.js';
import { ConfirmationService } from '../../../utils/confirmation-service.js';
import { getHookManager } from '../../../hooks/hook-manager.js';

/**
 * /help - Show help information
 */
const helpCommand: SlashCommand = {
  name: 'help',
  description: 'Show help and available commands',
  scope: 'builtin',
  argumentHint: '[command]',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args, addChatEntry } = ctx;

    // If a specific command is requested, show detailed help
    if (args.length > 0) {
      const cmdName = args[0].replace(/^\//, '');
      const suggestions = getCommandSuggestions(`/${cmdName}`);
      const exact = suggestions.find(s => s.command === `/${cmdName}`);

      if (exact) {
        const scopeIcon = exact.scope === 'builtin' ? '⚡' : exact.scope === 'project' ? '📁' : '👤';
        const entry: ChatEntry = {
          type: 'assistant',
          content: `${scopeIcon} **/${cmdName}**

${exact.description}

${exact.argumentHint ? `Usage: /${cmdName} ${exact.argumentHint}` : ''}
Scope: ${exact.scope}`,
          timestamp: new Date(),
        };
        addChatEntry(entry);
      } else {
        const entry: ChatEntry = {
          type: 'assistant',
          content: `Unknown command: /${cmdName}`,
          timestamp: new Date(),
        };
        addChatEntry(entry);
      }

      return { handled: true };
    }

    // Show general help
    const suggestions = getCommandSuggestions();
    const counts = getCommandCounts();

    const builtinCmds = suggestions.filter(s => s.scope === 'builtin');
    const projectCmds = suggestions.filter(s => s.scope === 'project');
    const userCmds = suggestions.filter(s => s.scope === 'user');

    let helpText = `# Horus CLI Help

## Built-in Commands (${counts.builtin})
${builtinCmds.map(c => `  ${c.command.padEnd(20)} ${c.description}`).join('\n')}
`;

    if (projectCmds.length > 0) {
      helpText += `
## Project Commands (${counts.project})
${projectCmds.map(c => `  ${c.command.padEnd(20)} ${c.description}`).join('\n')}
`;
    }

    if (userCmds.length > 0) {
      helpText += `
## User Commands (${counts.user})
${userCmds.map(c => `  ${c.command.padEnd(20)} ${c.description}`).join('\n')}
`;
    }

    helpText += `
## Keyboard Shortcuts
  Shift+Tab     Toggle auto-edit mode
  Ctrl+C        Clear input / abort
  ↑/↓           Navigate history
  Ctrl+←/→      Move by word
  Escape        Cancel current operation

## Custom Commands
  Project: .horus/commands/
  User:    ~/.horus/commands/

Type /help <command> for detailed help on a specific command.
`;

    const entry: ChatEntry = {
      type: 'assistant',
      content: helpText,
      timestamp: new Date(),
    };
    addChatEntry(entry);

    return { handled: true };
  },
};

/**
 * /clear - Clear chat history
 */
const clearCommand: SlashCommand = {
  name: 'clear',
  description: 'Clear chat history and reset state',
  scope: 'builtin',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    ctx.clearHistory();
    ctx.setProcessing(false);
    ctx.setStreaming(false);

    // Reset confirmation service
    const confirmationService = ConfirmationService.getInstance();
    confirmationService.resetSession();

    return { handled: true, message: 'Chat history cleared.' };
  },
};

/**
 * /exit - Exit the application
 */
const exitCommand: SlashCommand = {
  name: 'exit',
  description: 'Exit Horus CLI',
  scope: 'builtin',
  execute: async (): Promise<CommandResult> => {
    process.exit(0);
    return { handled: true };
  },
};

/**
 * /models - Show or switch models
 */
const modelsCommand: SlashCommand = {
  name: 'models',
  description: 'List available models or switch model',
  scope: 'builtin',
  argumentHint: '[model-name]',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args, agent, addChatEntry } = ctx;
    const models = loadModelConfig();

    if (args.length > 0) {
      // Switch to specified model
      const modelName = args[0];
      const found = models.find(m => m.model.toLowerCase() === modelName.toLowerCase());

      if (found) {
        agent.setModel(found.model);
        updateCurrentModel(found.model);

        const entry: ChatEntry = {
          type: 'assistant',
          content: `✓ Switched to model: ${found.model}`,
          timestamp: new Date(),
        };
        addChatEntry(entry);
      } else {
        const entry: ChatEntry = {
          type: 'assistant',
          content: `Unknown model: ${modelName}\n\nAvailable models:\n${models.map(m => `  • ${m.model}`).join('\n')}`,
          timestamp: new Date(),
        };
        addChatEntry(entry);
      }

      return { handled: true };
    }

    // Show available models
    const currentModel = agent.getCurrentModel();
    const modelList = models.map(m =>
      `  ${m.model === currentModel ? '→' : ' '} ${m.model}`
    ).join('\n');

    const entry: ChatEntry = {
      type: 'assistant',
      content: `# Available Models

Current: ${currentModel}

${modelList}

Usage: /models <model-name> to switch`,
      timestamp: new Date(),
    };
    addChatEntry(entry);

    return { handled: true };
  },
};

/**
 * /config - Show configuration
 */
const configCommand: SlashCommand = {
  name: 'config',
  description: 'Show current configuration',
  scope: 'builtin',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { agent, addChatEntry, cwd } = ctx;

    const dirStatus = await getCommandDirectoriesStatus(cwd);
    const counts = getCommandCounts();

    const entry: ChatEntry = {
      type: 'assistant',
      content: `# Horus Configuration

## Model
  Current: ${agent.getCurrentModel()}

## Working Directory
  ${cwd}

## Commands
  Built-in: ${counts.builtin}
  Project:  ${counts.project} (${dirStatus.projectDir})
  User:     ${counts.user} (${dirStatus.userDir})

## Auto-Edit Mode
  ${ConfirmationService.getInstance().getSessionFlags().allOperations ? 'Enabled' : 'Disabled'}

## Environment
  HORUS_MODEL:       ${process.env.HORUS_MODEL || '(not set)'}
  HORUS_API_KEY:     ${process.env.HORUS_API_KEY ? '(set)' : '(not set)'}
  HORUS_BASE_URL:    ${process.env.HORUS_BASE_URL || '(not set)'}
  MORPH_API_KEY:     ${process.env.MORPH_API_KEY ? '(set)' : '(not set)'}`,
      timestamp: new Date(),
    };
    addChatEntry(entry);

    return { handled: true };
  },
};

/**
 * /compact - Clear context and reset
 */
const compactCommand: SlashCommand = {
  name: 'compact',
  description: 'Compact context and clear cache',
  scope: 'builtin',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { agent, addChatEntry } = ctx;

    // Clear context cache if available
    agent.clearContextCache?.();

    const entry: ChatEntry = {
      type: 'assistant',
      content: '✓ Context cache cleared. Memory optimized.',
      timestamp: new Date(),
    };
    addChatEntry(entry);

    return { handled: true };
  },
};

/**
 * /init - Generate HORUS.md
 */
const initCommand: SlashCommand = {
  name: 'init',
  description: 'Generate HORUS.md documentation file',
  scope: 'builtin',
  argumentHint: '[--force]',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args, cwd } = ctx;
    const force = args.includes('--force') || args.includes('-f');

    // Import and run the init scanner/generator
    try {
      const { scanRepository } = await import('../../../init/scanner.js');
      const { generateHorusMd, writeHorusMd } = await import('../../../init/generator.js');
      const fs = await import('fs-extra');
      const path = await import('path');

      const targetPath = path.join(cwd, 'HORUS.md');

      // Check if file exists
      if (await fs.pathExists(targetPath) && !force) {
        return {
          handled: true,
          message: `HORUS.md already exists. Use /init --force to overwrite.`,
        };
      }

      // Scan and generate
      const scanResult = scanRepository({ cwd, targetFile: 'HORUS.md', force, includeGit: true, verbose: false });
      const content = generateHorusMd(scanResult);
      const result = writeHorusMd(content, cwd, 'HORUS.md');

      return {
        handled: true,
        message: `✓ ${result.message}`,
      };
    } catch (error: any) {
      return {
        handled: true,
        error: `Failed to generate HORUS.md: ${error.message}`,
      };
    }
  },
};

/**
 * /commit - AI-assisted git commit
 */
const commitCommand: SlashCommand = {
  name: 'commit',
  description: 'AI-generated git commit message',
  scope: 'builtin',
  argumentHint: '[--push]',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args, agent, addChatEntry, setProcessing, setStreaming } = ctx;
    const shouldPush = args.includes('--push') || args.includes('-p');

    setProcessing(true);
    setStreaming(true);

    try {
      // Check for changes
      const statusResult = await agent.executeBashCommand('git status --porcelain');

      if (!statusResult.success || !statusResult.output?.trim()) {
        setProcessing(false);
        setStreaming(false);
        return {
          handled: true,
          message: 'No changes to commit. Working directory is clean.',
        };
      }

      // Stage all changes
      await agent.executeBashCommand('git add .');

      // Get diff for commit message
      const diffResult = await agent.executeBashCommand('git diff --cached --stat');

      // Generate commit message using AI
      const prompt = `Generate a concise git commit message for these changes. Use conventional commit format (feat:, fix:, docs:, etc.).
Keep it under 72 characters. Respond with ONLY the commit message, no explanations.

Changes:
${statusResult.output}

Stats:
${diffResult.output || 'No stats available'}`;

      let commitMessage = '';

      for await (const chunk of agent.processUserMessageStream(prompt)) {
        if (chunk.type === 'content' && chunk.content) {
          commitMessage += chunk.content;
        }
        if (chunk.type === 'done') break;
      }

      commitMessage = commitMessage.trim().replace(/^["']|["']$/g, '');

      // Execute PreCommit hooks
      const hookManager = getHookManager();
      const stagedFilesResult = await agent.executeBashCommand('git diff --cached --name-only');
      const stagedFiles = stagedFilesResult.output?.trim().split('\n').filter(f => f) || [];

      const preCommitResults = await hookManager.executeHooks('PreCommit', {
        commitMessage,
        stagedFiles,
      });

      if (hookManager.hasBlockingFailure(preCommitResults)) {
        const failedHook = preCommitResults.find(r => r.blocked);
        setProcessing(false);
        setStreaming(false);
        return {
          handled: true,
          error: `PreCommit hook "${failedHook?.name}" blocked the commit: ${failedHook?.error}`,
        };
      }

      // Log hook results if any ran
      if (preCommitResults.length > 0) {
        const hookSummary = preCommitResults.map(r =>
          `  ${r.success ? '✓' : '⚠'} ${r.name} (${r.duration}ms)`
        ).join('\n');
        const hookEntry: ChatEntry = {
          type: 'assistant',
          content: `PreCommit hooks:\n${hookSummary}`,
          timestamp: new Date(),
        };
        addChatEntry(hookEntry);
      }

      // Execute commit
      const commitResult = await agent.executeBashCommand(`git commit -m "${commitMessage}"`);

      if (!commitResult.success) {
        setProcessing(false);
        setStreaming(false);
        return {
          handled: true,
          error: `Commit failed: ${commitResult.error}`,
        };
      }

      let resultMessage = `✓ Committed: "${commitMessage}"`;

      // Push if requested
      if (shouldPush) {
        let pushResult = await agent.executeBashCommand('git push');

        if (!pushResult.success && pushResult.error?.includes('no upstream')) {
          pushResult = await agent.executeBashCommand('git push -u origin HEAD');
        }

        if (pushResult.success) {
          resultMessage += '\n✓ Pushed to remote';
        } else {
          resultMessage += `\n✗ Push failed: ${pushResult.error}`;
        }
      }

      const entry: ChatEntry = {
        type: 'assistant',
        content: resultMessage,
        timestamp: new Date(),
      };
      addChatEntry(entry);

      setProcessing(false);
      setStreaming(false);
      return { handled: true };

    } catch (error: any) {
      setProcessing(false);
      setStreaming(false);
      return {
        handled: true,
        error: `Commit error: ${error.message}`,
      };
    }
  },
};

/**
 * /new-command - Create a new custom command
 */
const newCommandCommand: SlashCommand = {
  name: 'new-command',
  description: 'Create a new custom slash command',
  scope: 'builtin',
  argumentHint: '<name> [--user]',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args, cwd, addChatEntry } = ctx;

    if (args.length === 0) {
      return {
        handled: true,
        message: 'Usage: /new-command <name> [--user]\n\nExample: /new-command review\nCreates: .horus/commands/review.md',
      };
    }

    const name = args[0].replace(/^\//, '').toLowerCase();
    const isUser = args.includes('--user') || args.includes('-u');
    const scope = isUser ? 'user' : 'project';

    try {
      const path = await createCommandTemplate(name, scope, cwd);

      const entry: ChatEntry = {
        type: 'assistant',
        content: `✓ Created command template: ${path}

Edit this file to define your custom /${name} command.
The command will be available after you save the file.`,
        timestamp: new Date(),
      };
      addChatEntry(entry);

      return { handled: true };
    } catch (error: any) {
      return {
        handled: true,
        error: `Failed to create command: ${error.message}`,
      };
    }
  },
};

/**
 * /bug - Report a bug
 */
const bugCommand: SlashCommand = {
  name: 'bug',
  description: 'Report a bug or issue',
  scope: 'builtin',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { addChatEntry } = ctx;

    const entry: ChatEntry = {
      type: 'assistant',
      content: `# Report a Bug

To report a bug or issue with Horus CLI:

1. **GitHub Issues**: https://github.com/vibe-kit/horus-cli/issues

Please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Horus version and model used
- OS and terminal information`,
      timestamp: new Date(),
    };
    addChatEntry(entry);

    return { handled: true };
  },
};

/**
 * /hooks - Manage hooks
 */
const hooksCommand: SlashCommand = {
  name: 'hooks',
  description: 'Manage execution hooks',
  scope: 'builtin',
  argumentHint: '[list|add|remove|toggle] [options]',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { args, addChatEntry } = ctx;
    const hookManager = getHookManager();

    // Load hooks first
    await hookManager.loadHooks();

    const subcommand = args[0]?.toLowerCase() || 'list';

    switch (subcommand) {
      case 'list': {
        const hooks = await hookManager.getHooks();

        if (hooks.length === 0) {
          return {
            handled: true,
            message: `# Hooks

No hooks configured.

Use \`/hooks add <name> <type> <command>\` to add a hook.

Types: PreEdit, PostEdit, PreCommit, PreSubmit`,
          };
        }

        const hookLines = hooks.map(h => {
          const status = h.enabled ? '✓' : '✗';
          const mode = h.failureMode === 'block' ? '[block]' : '';
          return `  ${status} ${h.name.padEnd(20)} ${h.type.padEnd(12)} ${mode}\n      ${h.command}`;
        }).join('\n\n');

        const entry: ChatEntry = {
          type: 'assistant',
          content: `# Hooks

${hookLines}

Commands:
  /hooks add <name> <type> <command>
  /hooks remove <name>
  /hooks toggle <name>`,
          timestamp: new Date(),
        };
        addChatEntry(entry);
        return { handled: true };
      }

      case 'add': {
        if (args.length < 4) {
          return {
            handled: true,
            message: `Usage: /hooks add <name> <type> <command>

Types: PreEdit, PostEdit, PreCommit, PreSubmit

Example: /hooks add prettier PostEdit "prettier --write $FILE"`,
          };
        }

        const name = args[1];
        const type = args[2] as any;
        const command = args.slice(3).join(' ');

        const validTypes = ['PreEdit', 'PostEdit', 'PreCommit', 'PreSubmit'];
        if (!validTypes.includes(type)) {
          return {
            handled: true,
            error: `Invalid hook type: ${type}. Valid types: ${validTypes.join(', ')}`,
          };
        }

        try {
          await hookManager.addHook({
            name,
            type,
            command,
            enabled: true,
          });

          return {
            handled: true,
            message: `✓ Hook "${name}" added (${type})`,
          };
        } catch (error: any) {
          return {
            handled: true,
            error: error.message,
          };
        }
      }

      case 'remove': {
        const name = args[1];
        if (!name) {
          return {
            handled: true,
            message: 'Usage: /hooks remove <name>',
          };
        }

        const removed = await hookManager.removeHook(name);
        if (removed) {
          return {
            handled: true,
            message: `✓ Hook "${name}" removed`,
          };
        } else {
          return {
            handled: true,
            error: `Hook "${name}" not found`,
          };
        }
      }

      case 'toggle': {
        const name = args[1];
        if (!name) {
          return {
            handled: true,
            message: 'Usage: /hooks toggle <name>',
          };
        }

        const hooks = await hookManager.getHooks();
        const hook = hooks.find(h => h.name === name);

        if (!hook) {
          return {
            handled: true,
            error: `Hook "${name}" not found`,
          };
        }

        await hookManager.toggleHook(name);
        const newState = !hook.enabled;

        return {
          handled: true,
          message: `✓ Hook "${name}" ${newState ? 'enabled' : 'disabled'}`,
        };
      }

      default:
        return {
          handled: true,
          message: `Unknown subcommand: ${subcommand}

Usage: /hooks [list|add|remove|toggle]`,
        };
    }
  },
};

/**
 * /doctor - Diagnose issues
 */
const doctorCommand: SlashCommand = {
  name: 'doctor',
  description: 'Diagnose common issues',
  scope: 'builtin',
  execute: async (ctx: CommandContext): Promise<CommandResult> => {
    const { agent, addChatEntry, cwd } = ctx;

    const checks: string[] = [];

    // Check git
    const gitResult = await agent.executeBashCommand('git --version');
    checks.push(`Git: ${gitResult.success ? '✓ ' + (gitResult.output?.trim() || 'installed') : '✗ not found'}`);

    // Check if in git repo
    const gitRepoResult = await agent.executeBashCommand('git rev-parse --git-dir');
    checks.push(`Git repo: ${gitRepoResult.success ? '✓ detected' : '✗ not a git repository'}`);

    // Check node
    const nodeResult = await agent.executeBashCommand('node --version');
    checks.push(`Node: ${nodeResult.success ? '✓ ' + (nodeResult.output?.trim() || 'installed') : '✗ not found'}`);

    // Check model connectivity
    checks.push(`Model: ${agent.getCurrentModel()}`);

    // Check MCP
    const { getMCPManager } = await import('../../../horus/tools.js');
    const mcpManager = getMCPManager();
    const mcpTools = mcpManager ? mcpManager.getTools().length : 0;
    checks.push(`MCP tools: ${mcpTools} loaded`);

    // Check directories
    const dirStatus = await getCommandDirectoriesStatus(cwd);
    checks.push(`Project commands: ${dirStatus.projectExists ? `✓ ${dirStatus.projectCommandCount} found` : '✗ directory not found'}`);
    checks.push(`User commands: ${dirStatus.userExists ? `✓ ${dirStatus.userCommandCount} found` : '✗ directory not found'}`);

    const entry: ChatEntry = {
      type: 'assistant',
      content: `# Horus Doctor

## System Checks
${checks.map(c => `  ${c}`).join('\n')}

## Working Directory
  ${cwd}

All checks passed? If not, see /help or /bug for assistance.`,
      timestamp: new Date(),
    };
    addChatEntry(entry);

    return { handled: true };
  },
};

/**
 * Register all built-in commands
 */
export function registerBuiltinCommands(): void {
  registerBuiltinCommand(helpCommand);
  registerBuiltinCommand(clearCommand);
  registerBuiltinCommand(exitCommand);
  registerBuiltinCommand(modelsCommand);
  registerBuiltinCommand(configCommand);
  registerBuiltinCommand(compactCommand);
  registerBuiltinCommand(initCommand);
  registerBuiltinCommand(commitCommand);
  registerBuiltinCommand(newCommandCommand);
  registerBuiltinCommand(bugCommand);
  registerBuiltinCommand(doctorCommand);
  registerBuiltinCommand(hooksCommand);
}
