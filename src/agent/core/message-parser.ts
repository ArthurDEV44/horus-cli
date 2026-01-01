import { HorusToolCall } from "../../horus/client.js";
import type { VerificationResult } from "../../context/verification.js";

/**
 * MessageParser - Handles parsing and formatting of messages, tool calls, and verification feedback
 *
 * Responsibilities:
 * - Parse raw JSON tool calls from content (fallback for models without structured tool_calls)
 * - Extract file paths and operations from tool calls
 * - Format verification feedback for LLM consumption
 */
export class MessageParser {
  /**
   * Parse raw JSON tool calls from content (fallback for models that don't support structured tool_calls)
   * Some models like devstral return tool calls as raw JSON in the content field instead of using tool_calls
   */
  parseRawToolCalls(content: string): HorusToolCall[] | null {
    if (!content || typeof content !== "string") {
      return null;
    }

    // Check if content looks like a JSON array of tool calls
    const trimmed = content.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);

      // Validate that it's an array of tool-like objects
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return null;
      }

      // Check if all items have 'name' and 'arguments' properties (tool call format)
      const allValid = parsed.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.name === "string" &&
          item.arguments !== undefined
      );

      if (!allValid) {
        return null;
      }

      // Convert to HorusToolCall format
      return parsed.map((item, index) => ({
        id: `call_${Date.now()}_${index}`,
        type: "function" as const,
        function: {
          name: item.name,
          arguments:
            typeof item.arguments === "string"
              ? item.arguments
              : JSON.stringify(item.arguments),
        },
      }));
    } catch {
      // Not valid JSON or not a tool call format
      return null;
    }
  }

  /**
   * Extract file path from tool call arguments
   */
  extractFilePath(toolCall: HorusToolCall): string | undefined {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      return args.path || args.file_path || args.filePath || args.target_file;
    } catch {
      return undefined;
    }
  }

  /**
   * Extract operation type from tool name
   */
  extractOperation(
    toolName: string
  ): "view" | "create" | "str_replace" | "replace_lines" | "search" | undefined {
    const operationMap: Record<
      string,
      "view" | "create" | "str_replace" | "replace_lines" | "search"
    > = {
      view_file: "view",
      create_file: "create",
      str_replace_editor: "str_replace",
      replace_lines: "replace_lines",
      search_files: "search",
      search: "search",
    };
    return operationMap[toolName];
  }

  /**
   * Format verification feedback for LLM
   */
  formatVerificationFeedback(verificationResult: VerificationResult): string {
    const parts: string[] = [];

    if (
      verificationResult.checks.lint &&
      !verificationResult.checks.lint.passed
    ) {
      parts.push("**Lint issues:**");
      verificationResult.checks.lint.issues.forEach((issue: string) => {
        parts.push(`  - ${issue}`);
      });
    }

    if (
      verificationResult.checks.tests &&
      !verificationResult.checks.tests.passed
    ) {
      parts.push("\n**Test failures:**");
      parts.push(verificationResult.checks.tests.output);
    }

    if (
      verificationResult.checks.types &&
      !verificationResult.checks.types.passed
    ) {
      parts.push("\n**Type errors:**");
      verificationResult.checks.types.errors.forEach((error: string) => {
        parts.push(`  - ${error}`);
      });
    }

    return parts.join("\n");
  }
}
