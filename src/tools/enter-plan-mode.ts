/**
 * EnterPlanMode Tool - Programmatically enter planning mode
 *
 * Planning mode is a read-only mode for exploring the codebase
 * and designing implementation approaches before execution.
 */

import type { ToolResult } from '../types/index.js';
import { getPlanningModeService } from '../utils/planning-mode-service.js';

export interface EnterPlanModeOptions {
  planFile?: string;
}

export class EnterPlanModeTool {
  private planningService = getPlanningModeService();

  /**
   * Enter planning mode
   * @param options - Optional plan file path
   * @returns ToolResult with success status
   */
  async execute(options: EnterPlanModeOptions = {}): Promise<ToolResult> {
    try {
      // Check if already in planning mode
      if (this.planningService.isPlanningMode()) {
        return {
          success: true,
          output: 'Already in planning mode.',
          data: {
            mode: 'planning',
            planFile: this.planningService.getPlanFile(),
          },
        };
      }

      // Enter planning mode
      this.planningService.enterPlanMode(options.planFile);

      const planFileMsg = options.planFile
        ? `\nPlan file: ${options.planFile}`
        : '';

      return {
        success: true,
        output: `Entered planning mode.${planFileMsg}\n\nIn planning mode:\n- You can read files, search, and explore the codebase\n- File modifications are blocked\n- Use exit_plan_mode when ready to execute`,
        data: {
          mode: 'planning',
          planFile: options.planFile || null,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to enter planning mode: ${error.message}`,
      };
    }
  }

  /**
   * Check if currently in planning mode
   */
  isPlanningMode(): boolean {
    return this.planningService.isPlanningMode();
  }
}
