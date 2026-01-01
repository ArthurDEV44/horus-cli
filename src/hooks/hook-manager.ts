/**
 * HookManager - Singleton manager for hook execution
 * Phase 4: Hooks infrastructure for Horus CLI
 */

import { spawn } from "child_process";
import * as path from "path";
import * as os from "os";
import fs from "fs-extra";
import type {
  HookConfig,
  HookContext,
  HookResult,
  HookType,
  HooksConfigFile,
} from "./types.js";
import { HOOK_DEFAULTS } from "./types.js";

/**
 * HookManager - Manages hook configuration and execution
 */
export class HookManager {
  private static instance: HookManager;
  private hooks: HookConfig[] = [];
  private projectHooksPath: string;
  private userHooksPath: string;
  private loaded = false;

  private constructor() {
    this.projectHooksPath = path.join(process.cwd(), ".horus", "hooks.json");
    this.userHooksPath = path.join(os.homedir(), ".horus", "hooks.json");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): HookManager {
    if (!HookManager.instance) {
      HookManager.instance = new HookManager();
    }
    return HookManager.instance;
  }

  /**
   * Load hooks from config files
   */
  async loadHooks(): Promise<void> {
    this.hooks = [];

    // Load user hooks first (lower priority)
    const userHooks = await this.loadHooksFile(this.userHooksPath);
    this.hooks.push(...userHooks);

    // Load project hooks (higher priority, can override)
    const projectHooks = await this.loadHooksFile(this.projectHooksPath);

    // Merge: project hooks override user hooks with same name
    for (const projectHook of projectHooks) {
      const existingIndex = this.hooks.findIndex(h => h.name === projectHook.name);
      if (existingIndex >= 0) {
        this.hooks[existingIndex] = projectHook;
      } else {
        this.hooks.push(projectHook);
      }
    }

    this.loaded = true;
  }

  /**
   * Load hooks from a single file
   */
  private async loadHooksFile(filePath: string): Promise<HookConfig[]> {
    try {
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, "utf-8");
        const config: HooksConfigFile = JSON.parse(content);
        return config.hooks || [];
      }
    } catch {
      // Ignore parse errors, return empty
      console.error(`Warning: Failed to load hooks from ${filePath}`);
    }
    return [];
  }

  /**
   * Save hooks to project config file
   */
  async saveHooks(): Promise<void> {
    const config: HooksConfigFile = {
      version: 1,
      hooks: this.hooks.filter(() => {
        // Only save project hooks (not user hooks)
        // For now, save all hooks to project
        return true;
      }),
    };

    await fs.ensureDir(path.dirname(this.projectHooksPath));
    await fs.writeFile(
      this.projectHooksPath,
      JSON.stringify(config, null, 2),
      "utf-8"
    );
  }

  /**
   * Ensure hooks are loaded
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.loadHooks();
    }
  }

  /**
   * Get all hooks, optionally filtered by type
   */
  async getHooks(type?: HookType): Promise<HookConfig[]> {
    await this.ensureLoaded();

    if (type) {
      return this.hooks.filter(h => h.type === type);
    }
    return [...this.hooks];
  }

  /**
   * Get enabled hooks of a specific type
   */
  async getEnabledHooks(type: HookType): Promise<HookConfig[]> {
    await this.ensureLoaded();
    return this.hooks.filter(h => h.type === type && h.enabled);
  }

  /**
   * Add a new hook
   */
  async addHook(hook: Omit<HookConfig, "enabled"> & { enabled?: boolean }): Promise<void> {
    await this.ensureLoaded();

    // Check for duplicate name
    if (this.hooks.some(h => h.name === hook.name)) {
      throw new Error(`Hook with name "${hook.name}" already exists`);
    }

    const newHook: HookConfig = {
      ...hook,
      enabled: hook.enabled ?? HOOK_DEFAULTS.enabled,
      timeout: hook.timeout ?? HOOK_DEFAULTS.timeout,
      failureMode: hook.failureMode ?? HOOK_DEFAULTS.failureMode,
    };

    this.hooks.push(newHook);
    await this.saveHooks();
  }

  /**
   * Remove a hook by name
   */
  async removeHook(name: string): Promise<boolean> {
    await this.ensureLoaded();

    const index = this.hooks.findIndex(h => h.name === name);
    if (index < 0) {
      return false;
    }

    this.hooks.splice(index, 1);
    await this.saveHooks();
    return true;
  }

  /**
   * Toggle hook enabled state
   */
  async toggleHook(name: string, enabled?: boolean): Promise<boolean> {
    await this.ensureLoaded();

    const hook = this.hooks.find(h => h.name === name);
    if (!hook) {
      return false;
    }

    hook.enabled = enabled ?? !hook.enabled;
    await this.saveHooks();
    return true;
  }

  /**
   * Update a hook
   */
  async updateHook(name: string, updates: Partial<HookConfig>): Promise<boolean> {
    await this.ensureLoaded();

    const hook = this.hooks.find(h => h.name === name);
    if (!hook) {
      return false;
    }

    Object.assign(hook, updates);
    await this.saveHooks();
    return true;
  }

  /**
   * Execute all enabled hooks of a given type
   */
  async executeHooks(type: HookType, context: HookContext): Promise<HookResult[]> {
    const hooks = await this.getEnabledHooks(type);
    const results: HookResult[] = [];

    for (const hook of hooks) {
      const result = await this.executeHook(hook, context);
      results.push(result);

      // If hook failed and should block, stop execution
      if (!result.success && hook.failureMode === "block") {
        result.blocked = true;
        break;
      }
    }

    return results;
  }

  /**
   * Execute a single hook
   */
  private async executeHook(hook: HookConfig, context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    try {
      // Substitute variables in command
      const command = this.substituteVariables(hook.command, context);
      const timeout = hook.timeout ?? HOOK_DEFAULTS.timeout;

      // Execute command
      const { stdout, stderr, exitCode } = await this.runCommand(command, timeout);

      const duration = Date.now() - startTime;

      if (exitCode !== 0) {
        return {
          name: hook.name,
          success: false,
          output: stdout,
          error: stderr || `Exit code: ${exitCode}`,
          duration,
        };
      }

      return {
        name: hook.name,
        success: true,
        output: stdout,
        duration,
      };
    } catch (error: any) {
      return {
        name: hook.name,
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Substitute context variables in command
   */
  private substituteVariables(command: string, context: HookContext): string {
    let result = command;

    if (context.filePath) {
      result = result.replace(/\$FILE/g, context.filePath);
    }
    if (context.content) {
      // For content, use environment variable to avoid shell escaping issues
      result = result.replace(/\$CONTENT/g, context.content);
    }
    if (context.newContent) {
      result = result.replace(/\$NEW_CONTENT/g, context.newContent);
    }
    if (context.message) {
      result = result.replace(/\$MESSAGE/g, context.message);
    }
    if (context.commitMessage) {
      result = result.replace(/\$COMMIT_MSG/g, context.commitMessage);
    }
    if (context.stagedFiles) {
      result = result.replace(/\$STAGED_FILES/g, context.stagedFiles.join(" "));
    }

    return result;
  }

  /**
   * Run a shell command with timeout
   */
  private runCommand(
    command: string,
    timeout: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === "win32";
      const shell = isWindows ? "cmd.exe" : "/bin/bash";
      const shellArgs = isWindows ? ["/c", command] : ["-c", command];

      const child = spawn(shell, shellArgs, {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Hook timed out after ${timeout}ms`));
      }, timeout);

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 1,
        });
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Check if any blocking hook failed
   */
  hasBlockingFailure(results: HookResult[]): boolean {
    return results.some(r => r.blocked);
  }

  /**
   * Format results for display
   */
  formatResults(results: HookResult[]): string {
    if (results.length === 0) {
      return "No hooks executed";
    }

    const lines: string[] = [];
    for (const result of results) {
      const status = result.success ? "✓" : "✗";
      const blocked = result.blocked ? " [BLOCKED]" : "";
      lines.push(`${status} ${result.name} (${result.duration}ms)${blocked}`);

      if (result.error) {
        lines.push(`  Error: ${result.error}`);
      }
    }

    return lines.join("\n");
  }
}

/**
 * Get the global HookManager instance
 */
export function getHookManager(): HookManager {
  return HookManager.getInstance();
}
