import { HorusClient, HorusMessage, HorusToolCall } from "../../horus/client.js";
import { ToolResult } from "../../types/index.js";
import { TokenCounter } from "../../utils/token-counter.js";
import { MessageParser } from "./message-parser.js";

export interface StreamingChunk {
  type: "content" | "tool_calls" | "tool_result" | "done" | "token_count";
  content?: string;
  toolCalls?: HorusToolCall[];
  toolCall?: HorusToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
}

/**
 * StreamingManager - Handles streaming responses from the LLM
 *
 * Responsibilities:
 * - Stream LLM responses chunk by chunk
 * - Accumulate messages using messageReducer
 * - Detect and handle tool calls during streaming
 * - Manage abort controller for cancellation
 * - Track token counts in real-time
 */
export class StreamingManager {
  private abortController: AbortController | null = null;
  private parser: MessageParser;

  constructor(
    private horusClient: HorusClient,
    private tokenCounter: TokenCounter
  ) {
    this.parser = new MessageParser();
  }

  /**
   * Stream a response from the LLM
   * Yields chunks as they arrive and handles tool calls
   */
  async *streamResponse(
    messages: HorusMessage[],
    tools: any[],
    _onToolCall: (toolCall: HorusToolCall) => Promise<ToolResult>
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();

    let totalOutputTokens = 0;
    let lastTokenUpdate = 0;

    try {
      // Stream response and accumulate
      const stream = this.horusClient.chatStream(messages, tools);
      let accumulatedMessage: any = {};
      let accumulatedContent = "";
      let toolCallsYielded = false;
      let contentYielded = false;

      for await (const chunk of stream) {
        // Check for cancellation
        if (this.abortController?.signal.aborted) {
          yield {
            type: "content",
            content: "\n\n[Operation cancelled by user]",
          };
          yield { type: "done" };
          return;
        }

        if (!chunk.choices?.[0]) continue;

        // Accumulate the message using reducer
        accumulatedMessage = this.messageReducer(accumulatedMessage, chunk);

        // Check for tool calls - yield when we have complete tool calls with function names
        if (!toolCallsYielded && accumulatedMessage.tool_calls?.length > 0) {
          const hasCompleteTool = accumulatedMessage.tool_calls.some(
            (tc: any) => tc.function?.name
          );
          if (hasCompleteTool) {
            yield {
              type: "tool_calls",
              toolCalls: accumulatedMessage.tool_calls,
            };
            toolCallsYielded = true;
          }
        }

        // Stream content as it comes
        if (chunk.choices[0].delta?.content) {
          accumulatedContent += chunk.choices[0].delta.content;

          // Update token count in real-time
          const currentOutputTokens =
            this.tokenCounter.estimateStreamingTokens(accumulatedContent) +
            (accumulatedMessage.tool_calls
              ? this.tokenCounter.countTokens(
                  JSON.stringify(accumulatedMessage.tool_calls)
                )
              : 0);
          totalOutputTokens = currentOutputTokens;

          // Only yield content if we haven't yielded tool calls yet
          if (!toolCallsYielded) {
            const trimmed = accumulatedContent.trim();
            const startsWithBracket = trimmed.startsWith("[");

            // Detect if content looks like raw tool calls
            const looksLikeToolCalls =
              startsWithBracket &&
              (trimmed.startsWith("[{") ||
                trimmed.includes('"name"') ||
                trimmed.includes('"arguments"') ||
                trimmed.length < 50);

            // Only yield content if it doesn't look like tool calls
            if (!looksLikeToolCalls) {
              yield {
                type: "content",
                content: chunk.choices[0].delta.content,
              };
              contentYielded = true;
            }
          } else if (contentYielded) {
            yield {
              type: "content",
              content: chunk.choices[0].delta.content,
            };
          }

          // Emit token count update
          const now = Date.now();
          if (now - lastTokenUpdate > 250) {
            lastTokenUpdate = now;
            yield {
              type: "token_count",
              tokenCount: totalOutputTokens,
            };
          }
        }
      }

      // Fallback: Check if content contains raw JSON tool calls
      let finalToolCalls = accumulatedMessage.tool_calls;

      if (!finalToolCalls && accumulatedMessage.content) {
        const parsedToolCalls = this.parser.parseRawToolCalls(
          accumulatedMessage.content
        );
        if (parsedToolCalls) {
          finalToolCalls = parsedToolCalls;
          // Content cleared when tool calls are parsed
        }
      }

      // Note: AsyncGenerator doesn't return a value in TypeScript strict mode
      // The accumulated data is yielded through the stream chunks
    } catch (error: any) {
      // Check if this was a cancellation
      if (this.abortController?.signal.aborted) {
        yield {
          type: "content",
          content: "\n\n[Operation cancelled by user]",
        };
        yield { type: "done" };
        return;
      }

      throw error;
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  /**
   * Abort the current streaming operation
   */
  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Message reducer - accumulates streaming chunks into a complete message
   */
  private messageReducer(previous: any, item: any): any {
    const reduce = (acc: any, delta: any) => {
      acc = { ...acc };
      for (const [key, value] of Object.entries(delta)) {
        if (acc[key] === undefined || acc[key] === null) {
          acc[key] = value;
          // Clean up index properties from tool calls
          if (Array.isArray(acc[key])) {
            for (const arr of acc[key]) {
              delete arr.index;
            }
          }
        } else if (typeof acc[key] === "string" && typeof value === "string") {
          (acc[key] as string) += value;
        } else if (Array.isArray(acc[key]) && Array.isArray(value)) {
          const accArray = acc[key] as any[];
          for (let i = 0; i < value.length; i++) {
            if (!accArray[i]) accArray[i] = {};
            accArray[i] = reduce(accArray[i], value[i]);
          }
        } else if (typeof acc[key] === "object" && typeof value === "object") {
          acc[key] = reduce(acc[key], value);
        }
      }
      return acc;
    };

    return reduce(previous, item.choices[0]?.delta || {});
  }
}
