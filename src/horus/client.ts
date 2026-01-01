import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";
import { getModelMaxContext } from "./model-configs.js";

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

// SearchParameters and SearchOptions removed - not used with Ollama

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
  private currentModel = "devstral:24b";

  constructor(apiKey: string, model?: string, baseURL?: string) {
    // Ollama accepts any API key value, but we use empty string if not provided
    const actualApiKey = apiKey || "ollama";
    this.client = new OpenAI({
      apiKey: actualApiKey,
      baseURL: baseURL || process.env.HORUS_BASE_URL || "http://localhost:11434/v1",
      timeout: 360000,
    });
    if (model) {
      this.currentModel = model;
    }
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
      const maxContext = getModelMaxContext(selectedModel);

      const requestPayload: any = {
        model: selectedModel,
        messages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.2, // Lower temperature for more deterministic code generation
        // No max_tokens limit for local models - let Ollama manage it

        // Ollama-specific optimizations for quality
        // Context size is dynamically determined based on the model
        num_ctx: maxContext, // Maximum context window for current model
        num_predict: -1, // Generate until natural stopping point (better for code generation)
        top_p: 0.95, // Higher diversity for better code quality
        repeat_penalty: 1.1, // Avoid repetitions in tool calls
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
      const maxContext = getModelMaxContext(selectedModel);

      const requestPayload: any = {
        model: selectedModel,
        messages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.2, // Lower temperature for more deterministic code generation
        stream: true,
        // No max_tokens limit for local models - let Ollama manage it

        // Ollama-specific optimizations for quality
        // Context size is dynamically determined based on the model
        num_ctx: maxContext, // Maximum context window for current model
        num_predict: -1, // Generate until natural stopping point (better for code generation)
        top_p: 0.95, // Higher diversity for better code quality
        repeat_penalty: 1.1, // Avoid repetitions in tool calls
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
