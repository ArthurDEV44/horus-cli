/**
 * AskUserQuestion Tool - Ask structured questions with options
 *
 * Used during planning phase to clarify requirements,
 * validate assumptions, or get user decisions.
 */

import type { ToolResult } from '../types/index.js';

export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  question: string;
  header: string; // Short label (max 12 chars)
  options: QuestionOption[]; // 2-4 options
  multiSelect: boolean;
}

export interface AskUserQuestionOptions {
  questions: Question[];
}

export interface QuestionResponse {
  question: string;
  selectedOptions: string[]; // Labels of selected options
  customAnswer?: string; // If user chose "Other"
}

export class AskUserQuestionTool {
  private pendingQuestions: Question[] | null = null;
  private responseCallback: ((responses: QuestionResponse[]) => void) | null = null;

  /**
   * Ask questions to the user
   * @param options - Questions to ask
   * @returns ToolResult - The tool returns immediately, UI handles the interaction
   */
  async execute(options: AskUserQuestionOptions): Promise<ToolResult> {
    try {
      // Validate questions
      if (!options.questions || options.questions.length === 0) {
        return {
          success: false,
          error: 'At least one question is required',
        };
      }

      if (options.questions.length > 4) {
        return {
          success: false,
          error: 'Maximum 4 questions allowed',
        };
      }

      for (const q of options.questions) {
        if (!q.question || !q.header || !q.options) {
          return {
            success: false,
            error: 'Each question must have question, header, and options',
          };
        }

        if (q.header.length > 12) {
          return {
            success: false,
            error: `Header "${q.header}" exceeds 12 characters`,
          };
        }

        if (q.options.length < 2 || q.options.length > 4) {
          return {
            success: false,
            error: `Question "${q.header}" must have 2-4 options`,
          };
        }
      }

      // Store pending questions for UI to pick up
      this.pendingQuestions = options.questions;

      // Format questions for display
      const formattedQuestions = options.questions
        .map((q) => {
          const optionsStr = q.options
            .map((opt, j) => `  ${j + 1}. ${opt.label}: ${opt.description}`)
            .join('\n');
          return `[${q.header}] ${q.question}\n${optionsStr}`;
        })
        .join('\n\n');

      return {
        success: true,
        output: `Questions for user:\n\n${formattedQuestions}`,
        data: {
          questions: options.questions,
          pendingResponse: true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to ask questions: ${error.message}`,
      };
    }
  }

  /**
   * Check if there are pending questions
   */
  hasPendingQuestions(): boolean {
    return this.pendingQuestions !== null;
  }

  /**
   * Get pending questions
   */
  getPendingQuestions(): Question[] | null {
    return this.pendingQuestions;
  }

  /**
   * Set response callback for async handling
   */
  onResponse(callback: (responses: QuestionResponse[]) => void): void {
    this.responseCallback = callback;
  }

  /**
   * Submit responses (called by UI)
   */
  submitResponses(responses: QuestionResponse[]): void {
    this.pendingQuestions = null;
    if (this.responseCallback) {
      this.responseCallback(responses);
      this.responseCallback = null;
    }
  }

  /**
   * Clear pending questions
   */
  clearPending(): void {
    this.pendingQuestions = null;
    this.responseCallback = null;
  }
}
