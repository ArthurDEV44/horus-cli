import {
  VerificationPipeline,
} from "../../context/verification.js";
import { HorusToolCall } from "../../horus/client.js";
import { ToolResult } from "../../types/index.js";
import { MessageParser } from "../core/message-parser.js";

/**
 * VerifyPhase - Handles the VERIFY phase of the gather-act-verify loop
 *
 * Responsibilities:
 * - Verify tool execution results (lint, tests, types)
 * - Format verification feedback
 * - Handle verification errors gracefully
 */
export class VerifyPhase {
  private parser: MessageParser;

  constructor(private pipeline: VerificationPipeline) {
    this.parser = new MessageParser();
  }

  /**
   * Verify a tool execution result
   * Returns verification feedback if verification fails, null otherwise
   */
  async verify(
    toolCall: HorusToolCall,
    result: ToolResult,
    debug: boolean
  ): Promise<{
    passed: boolean;
    feedback?: string;
  } | null> {
    // Only verify successful operations
    if (!result.success) {
      return null;
    }

    try {
      const verificationResult = await this.pipeline.verify({
        success: result.success,
        output: result.output || "",
        filePath: this.parser.extractFilePath(toolCall),
        operation: this.parser.extractOperation(toolCall.function.name),
      });

      if (!verificationResult.passed) {
        const feedback = this.parser.formatVerificationFeedback(
          verificationResult
        );

        if (debug) {
          console.error("[VerifyPhase] Verification failed:", feedback);
        }

        return {
          passed: false,
          feedback,
        };
      }

      if (debug) {
        console.error("[VerifyPhase] Verification passed");
      }

      return {
        passed: true,
      };
    } catch (error) {
      if (debug) {
        console.error("[VerifyPhase] Verification error:", error);
      }
      // Return null to continue without verification on error
      return null;
    }
  }
}
