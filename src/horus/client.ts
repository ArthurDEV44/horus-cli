import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";

export type HorusMessage = ChatCompletionMessageParam;

export interface HorusTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface HorusToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface HorusResponse {
  choices: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: HorusToolCall[];
    };
    finish_reason: string;
  }[];
}

export class HorusClient {
  private client: OpenAI;
  private currentModel = "mistralai/Devstral-Small-2-24B-Instruct-2512";

  constructor(apiKey: string, model?: string, baseURL?: string) {
    // vLLM accepts any API key value for local deployment
    const actualApiKey = apiKey || "vllm";
    this.client = new OpenAI({
      apiKey: actualApiKey,
      baseURL: baseURL || process.env.HORUS_BASE_URL || "http://localhost:8000/v1",
      timeout: 360000,
    });
    if (model) {
      this.currentModel = model;
    }
  }

  /**
   * Normalize messages for strict role alternation (required by vLLM/Mistral)
   * - Merges system message into first user message
   * - Ensures user/assistant alternation
   * - Handles tool messages correctly
   */
  private normalizeMessages(messages: HorusMessage[]): HorusMessage[] {
    if (messages.length === 0) return messages;

    const normalized: HorusMessage[] = [];
    let systemContent = "";

    // Extract system messages and merge them
    for (const msg of messages) {
      if (msg.role === "system") {
        systemContent += (systemContent ? "\n\n" : "") + (msg.content || "");
      }
    }

    // Process non-system messages
    for (const msg of messages) {
      if (msg.role === "system") continue;

      if (msg.role === "user") {
        // Merge system content into first user message
        if (systemContent) {
          const userContent = typeof msg.content === "string" ? msg.content : "";
          normalized.push({
            ...msg,
            content: `[SYSTEM INSTRUCTIONS]\n${systemContent}\n[END SYSTEM INSTRUCTIONS]\n\n${userContent}`,
          });
          systemContent = ""; // Only merge once
        } else {
          normalized.push(msg);
        }
      } else {
        // assistant, tool messages
        normalized.push(msg);
      }
    }

    // If we still have system content but no user message, create one
    if (systemContent && normalized.length === 0) {
      normalized.push({
        role: "user",
        content: `[SYSTEM INSTRUCTIONS]\n${systemContent}\n[END SYSTEM INSTRUCTIONS]`,
      });
    }

    return normalized;
  }

  setModel(model: string): void {
    this.currentModel = model;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  async chat(
    messages: HorusMessage[],
    tools?: HorusTool[],
    model?: string
  ): Promise<HorusResponse> {
    try {
      const selectedModel = model || this.currentModel;

      // Normalize messages for strict role alternation (vLLM/Mistral requirement)
      const normalizedMessages = this.normalizeMessages(messages);

      const requestPayload: any = {
        model: selectedModel,
        messages: normalizedMessages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.15, // Low temperature for deterministic tool calling (Mistral recommendation)
        top_p: 0.95,
      };

      const response =
        await this.client.chat.completions.create(requestPayload);

      return response as HorusResponse;
    } catch (error: any) {
      throw new Error(`Horus API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: HorusMessage[],
    tools?: HorusTool[],
    model?: string
  ): AsyncGenerator<any, void, unknown> {
    try {
      const selectedModel = model || this.currentModel;

      // Normalize messages for strict role alternation (vLLM/Mistral requirement)
      const normalizedMessages = this.normalizeMessages(messages);

      const requestPayload: any = {
        model: selectedModel,
        messages: normalizedMessages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.15, // Low temperature for deterministic tool calling (Mistral recommendation)
        top_p: 0.95,
        stream: true,
      };

      const stream = (await this.client.chat.completions.create(
        requestPayload
      )) as any;

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: any) {
      throw new Error(`Horus API error: ${error.message}`);
    }
  }
}
