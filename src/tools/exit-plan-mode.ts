/**
 * ExitPlanMode Tool - Exit planning mode and transition to execution
 *
 * Called after plan approval to allow file modifications.
 */

import type { ToolResult } from '../types/index.js';
import { getPlanningModeService } from '../utils/planning-mode-service.js';
import { existsSync, readFileSync } from 'fs';

export class ExitPlanModeTool {
  private planningService = getPlanningModeService();

  /**
   * Exit planning mode
   * @returns ToolResult with plan file content if available
   */
  async execute(): Promise<ToolResult> {
    try {
      // Check if in planning mode
      if (!this.planningService.isPlanningMode()) {
        return {
          success: true,
          output: 'Not currently in planning mode.',
          data: {
            mode: this.planningService.getMode(),
            wasInPlanningMode: false,
          },
        };
      }

      // Get plan file before exiting
      const { planFile } = this.planningService.exitPlanMode();

      // Try to read plan file content if it exists
      let planContent: string | null = null;
      if (planFile && existsSync(planFile)) {
        try {
          planContent = readFileSync(planFile, 'utf-8');
        } catch {
          // Ignore read errors
        }
      }

      const planFileMsg = planFile ? `\nPlan file: ${planFile}` : '';

      return {
        success: true,
        output: `Exited planning mode. Ready to execute.${planFileMsg}`,
        data: {
          mode: 'normal',
          wasInPlanningMode: true,
          planFile,
          planContent,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to exit planning mode: ${error.message}`,
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
