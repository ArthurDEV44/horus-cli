import { HorusClient, HorusMessage, HorusToolCall } from "../horus/client.js";
import {
  getAllHorusTools,
  initializeMCPServers,
} from "../horus/tools.js";
import { loadMCPConfig } from "../mcp/config.js";
import {
  TextEditorTool,
  MorphEditorTool,
  BashTool,
  TodoTool,
  ConfirmationTool,
  SearchTool,
  GlobTool,
  GrepTool,
  LsTool,
  MultiEditTool,
} from "../tools/index.js";
import { ToolResult } from "../types/index.js";
import { EventEmitter } from "events";
import { createTokenCounter, TokenCounter } from "../utils/token-counter.js";
import { loadCustomInstructions } from "../utils/custom-instructions.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { ContextOrchestrator } from "../context/orchestrator.js";
import { getVerificationPipeline } from "../context/verification.js";
import type { IntentType } from "../types/context.js";

// Import new modular components
import { ToolExecutor } from "./core/tool-executor.js";
import { StreamingManager } from "./core/streaming-manager.js";
import type { StreamingChunk } from "./core/streaming-manager.js";
import { MessageParser } from "./core/message-parser.js";
import { ContextIntegrator } from "./core/context-integrator.js";
import { GatherPhase } from "./phases/gather-phase.js";
import { VerifyPhase } from "./phases/verify-phase.js";
import { buildSystemPrompt } from "./core/system-prompt.js";

export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call";
  content: string;
  timestamp: Date;
  toolCalls?: HorusToolCall[];
  toolCall?: HorusToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
  isStreaming?: boolean;
}

export { StreamingChunk };

/**
 * HorusAgent - Main orchestrator for the gather-act-verify loop
 *
 * This class has been refactored to use modular components:
 * - ToolExecutor: Handles all tool execution
 * - StreamingManager: Manages streaming responses
 * - MessageParser: Parses and formats messages
 * - ContextIntegrator: Handles context injection
 * - GatherPhase: GATHER phase (context orchestration)
 * - VerifyPhase: VERIFY phase (validation)
 */
export class HorusAgent extends EventEmitter {
  private horusClient: HorusClient;
  private chatHistory: ChatEntry[] = [];
  private messages: HorusMessage[] = [];
  private tokenCounter: TokenCounter;
  private mcpInitialized = false;
  private maxToolRounds: number;
  private currentModel: string;

  // Modular components
  private toolExecutor: ToolExecutor;
  private streamingManager: StreamingManager;
  private messageParser: MessageParser;
  private contextIntegrator: ContextIntegrator;
  private gatherPhase?: GatherPhase;
  private verifyPhase?: VerifyPhase;

  // Tool instances (needed for ToolExecutor)
  private textEditor: TextEditorTool;
  private morphEditor: MorphEditorTool | null;
  private bash: BashTool;
  private todoTool: TodoTool;
  private confirmationTool: ConfirmationTool;
  private search: SearchTool;
  private glob: GlobTool;
  private grep: GrepTool;
  private ls: LsTool;
  private multiEdit: MultiEditTool;

  constructor(
    apiKey: string,
    baseURL?: string,
    model?: string,
    maxToolRounds?: number
  ) {
    super();
    const manager = getSettingsManager();
    const savedModel = manager.getCurrentModel();
    const modelToUse = model || savedModel;
    this.currentModel = modelToUse;
    this.maxToolRounds = maxToolRounds || 400;
    this.horusClient = new HorusClient(apiKey, modelToUse, baseURL);
    this.tokenCounter = createTokenCounter(modelToUse);

    // Initialize tools
    this.textEditor = new TextEditorTool();
    this.morphEditor = process.env.MORPH_API_KEY ? new MorphEditorTool() : null;
    this.bash = new BashTool();
    this.todoTool = new TodoTool();
    this.confirmationTool = new ConfirmationTool();
    this.search = new SearchTool();
    this.glob = new GlobTool();
    this.grep = new GrepTool();
    this.ls = new LsTool();
    this.multiEdit = new MultiEditTool();

    // Initialize modular components
    this.toolExecutor = new ToolExecutor(
      this.textEditor,
      this.morphEditor,
      this.bash,
      this.todoTool,
      this.search,
      this.glob,
      this.grep,
      this.ls,
      this.multiEdit
    );
    this.streamingManager = new StreamingManager(
      this.horusClient,
      this.tokenCounter
    );
    this.messageParser = new MessageParser();
    this.contextIntegrator = new ContextIntegrator(this.tokenCounter);

    // Initialize context orchestrator (always enabled, native integration)
    const contextOrchestrator = new ContextOrchestrator({
      cacheEnabled: true,
      defaultContextPercent: 0.3,
      debug: process.env.HORUS_CONTEXT_DEBUG === 'true',
    });
    this.gatherPhase = new GatherPhase(contextOrchestrator);

    if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
      console.error(`[HorusAgent] Context orchestrator initialized (native integration)`);
    }

    // Initialize verification pipeline (always enabled, Phase 4 integration)
    const verificationMode = process.env.HORUS_VERIFY_MODE === 'thorough' ? 'thorough' : 'fast';
    const verificationPipeline = getVerificationPipeline({
      mode: verificationMode,
      lintEnabled: true,
      testsEnabled: verificationMode === 'thorough',
      typesEnabled: verificationMode === 'thorough',
    });
    this.verifyPhase = new VerifyPhase(verificationPipeline);

    if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
      console.error(`[HorusAgent] Verification pipeline initialized (mode: ${verificationMode})`);
    }

    // Initialize MCP servers if configured
    this.initializeMCP();

    // Initialize with system message
    this.messages.push({
      role: "system",
      content: buildSystemPrompt({
        cwd: process.cwd(),
        customInstructions: loadCustomInstructions(),
        hasMorphEditor: !!this.morphEditor,
      }),
    });
  }

  private async initializeMCP(): Promise<void> {
    // Initialize MCP in the background without blocking
    Promise.resolve().then(async () => {
      try {
        const config = loadMCPConfig();
        if (config.servers.length > 0) {
          await initializeMCPServers();
        }
      } catch (error) {
        console.warn("MCP initialization failed:", error);
      } finally {
        this.mcpInitialized = true;
      }
    });
  }

  /**
   * Process user message (non-streaming version)
   * Uses the gather-act-verify loop
   */
  async processUserMessage(message: string): Promise<ChatEntry[]> {
    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: message });

    const newEntries: ChatEntry[] = [userEntry];
    const maxToolRounds = this.maxToolRounds;
    let toolRounds = 0;
    const debug = process.env.HORUS_CONTEXT_DEBUG === 'true';

    // GATHER PHASE: Context orchestration
    if (this.gatherPhase) {
      const contextRequest = this.contextIntegrator.buildContextRequest(
        message,
        this.chatHistory,
        this.messages,
        this.currentModel,
        (query: string) => this.detectIntent(query)
      );

      const contextBundle = await this.gatherPhase.gather(contextRequest, debug);

      if (contextBundle && contextBundle.sources.length > 0) {
        this.contextIntegrator.injectContextBundle(
          contextBundle,
          this.messages,
          debug
        );
      }
    }

    // ACT PHASE: Execute agent loop
    try {
      const tools = await getAllHorusTools();
      let currentResponse = await this.horusClient.chat(this.messages, tools);

      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        const assistantMessage = currentResponse.choices[0]?.message;

        if (!assistantMessage) {
          throw new Error("No response from Horus");
        }

        // Fallback: Check if content contains raw JSON tool calls
        let finalToolCalls = assistantMessage.tool_calls;
        let finalContent = assistantMessage.content;

        if (!finalToolCalls && assistantMessage.content) {
          const parsedToolCalls = this.messageParser.parseRawToolCalls(
            assistantMessage.content
          );
          if (parsedToolCalls) {
            finalToolCalls = parsedToolCalls;
            finalContent = "";
          }
        }

        // Handle tool calls
        if (finalToolCalls && finalToolCalls.length > 0) {
          toolRounds++;

          // Add assistant message with tool calls
          const assistantEntry: ChatEntry = {
            type: "assistant",
            content: finalContent || "Using tools to help you...",
            timestamp: new Date(),
            toolCalls: finalToolCalls,
          };
          this.chatHistory.push(assistantEntry);
          newEntries.push(assistantEntry);

          // Add assistant message to conversation
          this.messages.push({
            role: "assistant",
            content: finalContent || "",
            tool_calls: finalToolCalls,
          } as any);

          // Create initial tool call entries
          finalToolCalls.forEach((toolCall) => {
            const toolCallEntry: ChatEntry = {
              type: "tool_call",
              content: "Executing...",
              timestamp: new Date(),
              toolCall: toolCall,
            };
            this.chatHistory.push(toolCallEntry);
            newEntries.push(toolCallEntry);
          });

          // Execute tool calls
          for (const toolCall of finalToolCalls) {
            const result = await this.toolExecutor.executeTool(toolCall);

            // VERIFY PHASE: Verify tool result
            if (this.verifyPhase && result.success) {
              const verificationResult = await this.verifyPhase.verify(
                toolCall,
                result,
                debug
              );

              if (verificationResult && !verificationResult.passed) {
                // Inject verification feedback
                this.messages.push({
                  role: "user",
                  content: `⚠️ Verification failed:\n${verificationResult.feedback}\n\nPlease fix the issues above.`,
                });

                const feedbackEntry: ChatEntry = {
                  type: "assistant",
                  content: `⚠️ Verification issues detected:\n${verificationResult.feedback}`,
                  timestamp: new Date(),
                };
                this.chatHistory.push(feedbackEntry);
                newEntries.push(feedbackEntry);
              }
            }

            // Update the existing tool_call entry with the result
            const entryIndex = this.chatHistory.findIndex(
              (entry) =>
                entry.type === "tool_call" && entry.toolCall?.id === toolCall.id
            );

            if (entryIndex !== -1) {
              const updatedEntry: ChatEntry = {
                ...this.chatHistory[entryIndex],
                type: "tool_result",
                content: result.success
                  ? result.output || "Success"
                  : result.error || "Error occurred",
                toolResult: result,
              };
              this.chatHistory[entryIndex] = updatedEntry;

              const newEntryIndex = newEntries.findIndex(
                (entry) =>
                  entry.type === "tool_call" && entry.toolCall?.id === toolCall.id
              );
              if (newEntryIndex !== -1) {
                newEntries[newEntryIndex] = updatedEntry;
              }
            }

            // Add tool result to messages
            this.messages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Get next response
          currentResponse = await this.horusClient.chat(this.messages, tools);
        } else {
          // No more tool calls, add final response
          const finalEntry: ChatEntry = {
            type: "assistant",
            content:
              assistantMessage.content ||
              "I understand, but I don't have a specific response.",
            timestamp: new Date(),
          };
          this.chatHistory.push(finalEntry);
          this.messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
          });
          newEntries.push(finalEntry);
          break;
        }
      }

      if (toolRounds >= maxToolRounds) {
        const warningEntry: ChatEntry = {
          type: "assistant",
          content:
            "Maximum tool execution rounds reached. Stopping to prevent infinite loops.",
          timestamp: new Date(),
        };
        this.chatHistory.push(warningEntry);
        newEntries.push(warningEntry);
      }

      return newEntries;
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      return [userEntry, errorEntry];
    }
  }

  /**
   * Process user message (streaming version)
   * Uses the gather-act-verify loop with streaming
   */
  async *processUserMessageStream(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.messages.push({ role: "user", content: message });

    // Calculate input tokens
    let inputTokens = this.tokenCounter.countMessageTokens(
      this.messages as any
    );
    yield {
      type: "token_count",
      tokenCount: inputTokens,
    };

    const debug = process.env.HORUS_CONTEXT_DEBUG === 'true';

    // GATHER PHASE: Context orchestration
    if (this.gatherPhase) {
      const contextRequest = this.contextIntegrator.buildContextRequest(
        message,
        this.chatHistory,
        this.messages,
        this.currentModel,
        (query: string) => this.detectIntent(query)
      );

      const contextBundle = await this.gatherPhase.gather(contextRequest, debug);

      if (contextBundle && contextBundle.sources.length > 0) {
        this.contextIntegrator.injectContextBundle(
          contextBundle,
          this.messages,
          debug
        );
      }
    }

    const maxToolRounds = this.maxToolRounds;
    let toolRounds = 0;

    try {
      // Agent loop
      while (toolRounds < maxToolRounds) {
        const tools = await getAllHorusTools();
        const stream = this.horusClient.chatStream(this.messages, tools);

        let accumulatedMessage: any = {};
        let accumulatedContent = "";
        let toolCallsYielded = false;
        let contentYielded = false;

        // Stream the response
        for await (const chunk of stream) {
          if (!chunk.choices?.[0]) continue;

          // Accumulate message
          accumulatedMessage = this.messageReducer(accumulatedMessage, chunk);

          // Check for tool calls
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

          // Stream content
          if (chunk.choices[0].delta?.content) {
            accumulatedContent += chunk.choices[0].delta.content;

            if (!toolCallsYielded) {
              const trimmed = accumulatedContent.trim();
              const looksLikeToolCalls =
                trimmed.startsWith("[") &&
                (trimmed.startsWith("[{") ||
                  trimmed.includes('"name"') ||
                  trimmed.includes('"arguments"') ||
                  trimmed.length < 50);

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
          }
        }

        // Check for raw tool calls
        let finalToolCalls = accumulatedMessage.tool_calls;
        let finalContent = accumulatedMessage.content;

        if (!finalToolCalls && accumulatedMessage.content) {
          const parsedToolCalls = this.messageParser.parseRawToolCalls(
            accumulatedMessage.content
          );
          if (parsedToolCalls) {
            finalToolCalls = parsedToolCalls;
            finalContent = "";
          }
        }

        // Add to history
        const assistantEntry: ChatEntry = {
          type: "assistant",
          content: finalContent || "Using tools to help you...",
          timestamp: new Date(),
          toolCalls: finalToolCalls || undefined,
        };
        this.chatHistory.push(assistantEntry);

        this.messages.push({
          role: "assistant",
          content: finalContent || "",
          tool_calls: finalToolCalls,
        } as any);

        // Execute tools if present
        if (finalToolCalls?.length > 0) {
          toolRounds++;

          if (!toolCallsYielded) {
            yield {
              type: "tool_calls",
              toolCalls: finalToolCalls,
            };
          }

          for (const toolCall of finalToolCalls) {
            const result = await this.toolExecutor.executeTool(toolCall);

            // VERIFY PHASE
            if (this.verifyPhase && result.success) {
              const verificationResult = await this.verifyPhase.verify(
                toolCall,
                result,
                debug
              );

              if (verificationResult && !verificationResult.passed) {
                this.messages.push({
                  role: "user",
                  content: `⚠️ Verification failed:\n${verificationResult.feedback}\n\nPlease fix the issues above.`,
                });

                yield {
                  type: "content",
                  content: `\n\n⚠️ Verification issues:\n${verificationResult.feedback}\n`,
                };
              }
            }

            const toolResultEntry: ChatEntry = {
              type: "tool_result",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error occurred",
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: result,
            };
            this.chatHistory.push(toolResultEntry);

            yield {
              type: "tool_result",
              toolCall,
              toolResult: result,
            };

            this.messages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }
        } else {
          // No tool calls, done
          break;
        }
      }

      if (toolRounds >= maxToolRounds) {
        yield {
          type: "content",
          content:
            "\n\nMaximum tool execution rounds reached. Stopping to prevent infinite loops.",
        };
      }

      yield { type: "done" };
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      yield {
        type: "content",
        content: errorEntry.content,
      };
      yield { type: "done" };
    }
  }

  /**
   * Message reducer - accumulates streaming chunks
   */
  private messageReducer(previous: any, item: any): any {
    const reduce = (acc: any, delta: any) => {
      acc = { ...acc };
      for (const [key, value] of Object.entries(delta)) {
        if (acc[key] === undefined || acc[key] === null) {
          acc[key] = value;
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

  /**
   * Detect user intent from query (used by context orchestrator)
   */
  private detectIntent(query: string): IntentType {
    const q = query.toLowerCase();

    // English patterns
    if (q.includes("explain") || q.includes("what")) return "explain";
    if (q.includes("refactor") || q.includes("improve")) return "refactor";
    if (q.includes("fix") || q.includes("debug")) return "debug";
    if (q.includes("add") || q.includes("implement")) return "implement";
    if (q.includes("search") || q.includes("find")) return "search";

    // French patterns
    if (q.includes("explique") || q.includes("qu'est-ce")) return "explain";
    if (q.includes("refactoriser")) return "refactor";
    if (q.includes("corriger") || q.includes("réparer")) return "debug";
    if (q.includes("ajouter") || q.includes("implémenter")) return "implement";
    if (q.includes("chercher") || q.includes("trouver")) return "search";

    return "general";
  }

  // Public API methods
  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.toolExecutor.getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.toolExecutor.executeBashCommand(command);
  }

  getCurrentModel(): string {
    return this.horusClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.horusClient.setModel(model);
    this.tokenCounter.dispose();
    this.tokenCounter = createTokenCounter(model);
    this.currentModel = model;
  }

  abortCurrentOperation(): void {
    this.streamingManager.abortCurrentOperation();
  }

  getContextStats() {
    return this.gatherPhase?.getCacheStats();
  }

  clearContextCache() {
    this.gatherPhase?.clearCache();
  }
}
