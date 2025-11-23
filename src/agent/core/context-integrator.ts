import { HorusMessage } from "../../horus/client.js";
import { TokenCounter } from "../../utils/token-counter.js";
import type {
  ContextBundle,
  ContextRequest,
  IntentType,
} from "../../types/context.js";
import { getModelMaxContext } from "../../horus/model-configs.js";
import type { ChatEntry } from "../horus-agent.js";

/**
 * ContextIntegrator - Handles context bundle injection and request building
 *
 * Responsibilities:
 * - Build context requests with budget management
 * - Inject context bundles into message history
 * - Format context for LLM consumption
 */
export class ContextIntegrator {
  constructor(private tokenCounter: TokenCounter) {}

  /**
   * Build a context request from user message and chat history
   */
  buildContextRequest(
    message: string,
    chatHistory: ChatEntry[],
    messages: HorusMessage[],
    currentModel: string,
    detectIntent: (query: string) => IntentType
  ): ContextRequest {
    const maxContext = getModelMaxContext(currentModel);
    const historyTokens = this.tokenCounter.countTokens(
      JSON.stringify(messages)
    );

    return {
      intent: detectIntent(message),
      query: message,
      currentContext: chatHistory,
      budget: {
        maxTokens: maxContext,
        reservedForContext: 0.3,
        usedByHistory: historyTokens,
        available: Math.max(0, Math.floor(maxContext * 0.3) - historyTokens),
      },
    };
  }

  /**
   * Inject context bundle into message history
   * Adds relevant context sources as system messages
   */
  injectContextBundle(
    bundle: ContextBundle,
    messages: HorusMessage[],
    debug: boolean
  ): void {
    if (bundle.sources.length === 0) {
      return;
    }

    // Build context message
    const contextParts: string[] = [
      "=== RELEVANT CONTEXT ===",
      "",
      `Strategy: ${bundle.metadata.strategy}`,
      `Sources: ${bundle.sources.length} files`,
      `Tokens: ${bundle.metadata.tokensUsed}`,
      `Cache hits: ${bundle.metadata.cacheHits || 0}/${bundle.sources.length}`,
      "",
    ];

    // Add each source
    for (const source of bundle.sources) {
      contextParts.push(`--- ${source.path} ---`);

      // Add metadata if available
      if (source.metadata.reasons && source.metadata.reasons.length > 0) {
        contextParts.push(`Relevance: ${source.metadata.reasons.join(", ")}`);
      }
      if (source.lineRange) {
        contextParts.push(
          `Lines: ${source.lineRange.start}-${source.lineRange.end}`
        );
      }

      contextParts.push("");
      contextParts.push(source.content);
      contextParts.push("");
    }

    contextParts.push("=== END CONTEXT ===");

    const contextMessage = contextParts.join("\n");

    // Add as system message to preserve context
    messages.push({
      role: "system",
      content: contextMessage,
    });

    if (debug) {
      console.error("[ContextIntegrator] Context bundle injected into messages");
    }
  }
}
