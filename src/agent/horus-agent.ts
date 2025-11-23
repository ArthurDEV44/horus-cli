import { HorusClient, HorusMessage, HorusToolCall } from "../horus/client.js";
import {
  HORUS_TOOLS,
  addMCPToolsToHorusTools,
  getAllHorusTools,
  getMCPManager,
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
} from "../tools/index.js";
import { ToolResult } from "../types/index.js";
import { EventEmitter } from "events";
import { createTokenCounter, TokenCounter } from "../utils/token-counter.js";
import { loadCustomInstructions } from "../utils/custom-instructions.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { ContextOrchestrator } from "../context/orchestrator.js";
import type { ContextRequest, ContextBundle } from "../types/context.js";
import { getModelMaxContext } from "../horus/model-configs.js";
import { getVerificationPipeline, VerificationPipeline, ToolResult as VerificationToolResult } from "../context/verification.js";

export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call";
  content: string;
  timestamp: Date;
  toolCalls?: HorusToolCall[];
  toolCall?: HorusToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
  isStreaming?: boolean;
}

export interface StreamingChunk {
  type: "content" | "tool_calls" | "tool_result" | "done" | "token_count";
  content?: string;
  toolCalls?: HorusToolCall[];
  toolCall?: HorusToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
}

export class HorusAgent extends EventEmitter {
  private horusClient: HorusClient;
  private textEditor: TextEditorTool;
  private morphEditor: MorphEditorTool | null;
  private bash: BashTool;
  private todoTool: TodoTool;
  private confirmationTool: ConfirmationTool;
  private search: SearchTool;
  private chatHistory: ChatEntry[] = [];
  private messages: HorusMessage[] = [];
  private tokenCounter: TokenCounter;
  private abortController: AbortController | null = null;
  private mcpInitialized: boolean = false;
  private maxToolRounds: number;
  private contextOrchestrator?: ContextOrchestrator;
  private contextMode: 'off' | 'mvp' | 'full';
  private currentModel: string;
  private verificationPipeline?: VerificationPipeline;

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
    this.textEditor = new TextEditorTool();
    this.morphEditor = process.env.MORPH_API_KEY ? new MorphEditorTool() : null;
    this.bash = new BashTool();
    this.todoTool = new TodoTool();
    this.confirmationTool = new ConfirmationTool();
    this.search = new SearchTool();
    this.tokenCounter = createTokenCounter(modelToUse);

    // Initialize context orchestrator (always enabled, Phase 1-4 integration)
    this.contextMode = 'full'; // Native integration, no longer a flag
    this.contextOrchestrator = new ContextOrchestrator({
      cacheEnabled: true,
      defaultContextPercent: 0.3,
      debug: process.env.HORUS_CONTEXT_DEBUG === 'true',
    });

    if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
      console.error(`[HorusAgent] Context orchestrator initialized (native integration)`);
    }

    // Initialize verification pipeline (always enabled, Phase 4 integration)
    const verificationMode = process.env.HORUS_VERIFY_MODE === 'thorough' ? 'thorough' : 'fast';
    {
      this.verificationPipeline = getVerificationPipeline({
        mode: verificationMode,
        lintEnabled: true,
        testsEnabled: verificationMode === 'thorough',
        typesEnabled: verificationMode === 'thorough',
      });

      if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
        console.error(`[HorusAgent] Verification pipeline initialized (mode: ${verificationMode})`);
      }
    }

    // Initialize MCP servers if configured
    this.initializeMCP();

    // Load custom instructions
    const customInstructions = loadCustomInstructions();
    const customInstructionsSection = customInstructions
      ? `\n\nCUSTOM INSTRUCTIONS:\n${customInstructions}\n\nThe above custom instructions should be followed alongside the standard instructions below.`
      : "";

    // Initialize with system message
    this.messages.push({
      role: "system",
      content: `You are Horus CLI, a helpful agentic AI assistant for software engineering tasks.

CRITICAL LANGUAGE RULE: You MUST respond in the same language as the user's input.
- User writes in French → You respond in French
- User writes in English → You respond in English
- User writes in Spanish → You respond in Spanish
Example in French: Si l'utilisateur écrit "Peux-tu m'expliquer ce projet ?", tu dois répondre ENTIÈREMENT en français.
Example in English: If user writes "Can you explain this project?", you respond entirely in English.

TOOLS: You have powerful tools (view_file, search, bash). When asked about a project or files, USE TOOLS IMMEDIATELY to gather info, then respond in user's language.

Example workflow: "Peux-tu m'expliquer ce projet ?" → call view_file("README.md") → call view_file("package.json") → respond in FRENCH summarizing what you found.${customInstructionsSection}

You have access to these tools:
- view_file: View file contents or directory listings
- create_file: Create new files with content (ONLY use this for files that don't exist yet)
- str_replace_editor: Replace text in existing files (best for exact text matches, single-line edits)
- replace_lines: Replace a range of lines by line numbers (use when str_replace_editor fails or for multi-line edits)${
        this.morphEditor
          ? "\n- edit_file: High-speed file editing with Morph Fast Apply (4,500+ tokens/sec with 98% accuracy)"
          : ""
      }
- bash: Execute bash commands (use for searching, file discovery, navigation, and system operations)
- search: Unified search tool for finding text content or files (similar to Cursor's search functionality)
- create_todo_list: Create a visual todo list for planning and tracking tasks
- update_todo_list: Update existing todos in your todo list

REAL-TIME INFORMATION:
You have access to real-time web search and X (Twitter) data. When users ask for current information, latest news, or recent events, you automatically have access to up-to-date information from the web and social media.

IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist - this will overwrite them completely
- Use str_replace_editor for exact text replacements (best for single-line edits)
- If str_replace_editor fails with "String not found", use replace_lines instead (works by line numbers)
- replace_lines is more reliable for multi-line edits or when exact text matching fails
- Before editing a file, use view_file to see its current contents (note the line numbers)
- Use create_file ONLY when creating entirely new files that don't exist

SEARCHING AND EXPLORATION:
- Use search for fast, powerful text search across files or finding files by name (unified search tool)
- Examples: search for text content like "import.*react", search for files like "component.tsx"
- Use bash with commands like 'find', 'grep', 'rg', 'ls' for complex file operations and navigation
- view_file is best for reading specific files you already know exist
- view_file shows all lines for files ≤100 lines, or first 50 lines for larger files
- If view_file shows "... +X more lines", use start_line and end_line parameters to view the rest
- IMPORTANT: When exploring a codebase, focus on source directories (src/, lib/, app/) and documentation files
- NEVER explore or read files in: node_modules/, .git/, dist/, build/, or other dependency/build directories
- These directories are automatically filtered when using view_file on directories
- For codebase analysis, start with README.md, package.json, and main source directories

CRITICAL FILE LOCATION WORKFLOW:
⚠️ IMPORTANT: If a user mentions a file WITHOUT providing its full path, you MUST search for it first!

When to search BEFORE reading:
- User mentions a file name without a path: "errors in config.yml", "check security.yml", etc.
- File could be in subdirectories (workflows/, config/, src/, tests/, etc.)
- Exception: Well-known root files like package.json, README.md, .gitignore can be read directly

Workflow when file location is unknown:
1. FIRST: Use search to find the file: search(query: "filename.ext", search_type: "files")
2. THEN: Once found, use view_file with the full path returned by search
3. FINALLY: Make changes with str_replace_editor if needed

Example:
❌ BAD: User says "errors in config.yml" → You call view_file("config.yml") → FAILS (not in root)
✅ GOOD: User says "errors in config.yml" → You call search(query: "config.yml", search_type: "files") → Find ".github/config.yml" → Then view_file(".github/config.yml") → SUCCESS

Note: The search tool now correctly searches in configuration directories like .github/, .vscode/, .horus/, etc.

CRITICAL: TOOL USAGE AND RESPONSE WORKFLOW:
⚠️ IMPORTANT: After using tools to gather information, you MUST provide a text response analyzing what you found.
- Step 1: Use tools to collect information (view_file, search, bash, etc.)
- Step 2: ANALYZE the information you collected
- Step 3: RESPOND to the user in their language with your analysis
- Example: User asks "What does this project do?" → You call view_file on README.md and package.json → Then you MUST respond with a summary in the user's language
- DO NOT just call tools and stop - always follow up with a text response explaining what you discovered

AUTO-EDIT WORKFLOW (Proactive File Editing):
When a user reports an error, bug, or issue in a file, or asks you to fix something:
1. DO NOT ask "Should I proceed?" or "Would you like me to fix this?" - just fix it directly
2. The system will automatically show you a confirmation dialog with the proposed changes
3. User can approve once, or approve "yes for this session" to auto-accept future operations
4. Workflow: Search for file → View file → Identify problem → Apply fix directly → System asks confirmation

File editing workflow:
1. If the file path is not explicit, use search to find it first
2. Then use view_file to see the current contents (note the line numbers)
3. Try str_replace_editor first for simple exact text matches
4. If str_replace_editor fails with "String not found", use replace_lines with the appropriate line numbers
5. replace_lines is especially useful for multi-line edits or when whitespace/formatting differs
6. Never use create_file for existing files
7. ACT DIRECTLY: When you identify a fix, apply it immediately - don't ask permission first

When a user asks you to create a new file that doesn't exist:
1. Use create_file with the full content

TASK PLANNING WITH TODO LISTS:
- For complex requests with multiple steps, ALWAYS create a todo list first to plan your approach
- Use create_todo_list to break down tasks into manageable items with priorities
- Mark tasks as 'in_progress' when you start working on them (only one at a time)
- Mark tasks as 'completed' immediately when finished
- Use update_todo_list to track your progress throughout the task
- Todo lists provide visual feedback with colors: ✅ Green (completed), 🔄 Cyan (in progress), ⏳ Yellow (pending)
- Always create todos with priorities: 'high' (🔴), 'medium' (🟡), 'low' (🟢)

USER CONFIRMATION SYSTEM:
- File operations (create_file, str_replace_editor, replace_lines) automatically show a confirmation dialog with the proposed changes
- Users can approve once, or choose "Yes for this session" to auto-accept future operations of that type
- DO NOT ask "Should I fix this?" - just fix it directly and let the confirmation system handle approval
- If a user rejects an operation, the tool will return an error and you should explain why it was rejected
- Be proactive: When you identify a fix, apply it immediately rather than asking for permission first

IMPORTANT RESPONSE GUIDELINES:
- After using tools, do NOT respond with pleasantries like "Thanks for..." or "Great!"
- Only provide necessary explanations or next steps if relevant to the task
- Keep responses concise and focused on the actual work being done
- If a tool execution completes the user's request, you can remain silent or give a brief confirmation

CRITICAL: NEVER ASK FOR PERMISSION TO FIX ISSUES:
- When a user reports an error or bug, DO NOT ask "Should I fix this?" or "Would you like me to proceed?"
- Just fix it directly - the confirmation system will handle user approval automatically
- Example: User says "I have error X in file Y" → You search for file → View it → Fix it → System shows confirmation dialog
- The confirmation dialog allows users to approve once or approve for the entire session (auto-edit mode)
- Your job is to identify problems and fix them proactively, not to ask permission

Current working directory: ${process.cwd()}

FINAL REMINDER: Always match the user's language. French question → French answer. English question → English answer. Use tools first, then respond.`,
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
    const maxToolRounds = this.maxToolRounds; // Prevent infinite loops
    let toolRounds = 0;

    // GATHER PHASE: Context orchestration (if enabled)
    if (this.contextOrchestrator) {
      try {
        const maxContext = getModelMaxContext(this.currentModel);
        const historyTokens = this.tokenCounter.countTokens(
          JSON.stringify(this.messages)
        );

        const contextRequest: ContextRequest = {
          intent: this.contextOrchestrator.detectIntent(message),
          query: message,
          currentContext: this.chatHistory,
          budget: {
            maxTokens: maxContext,
            reservedForContext: 0.3,
            usedByHistory: historyTokens,
            available: Math.max(0, Math.floor(maxContext * 0.3) - historyTokens),
          },
        };

        if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
          console.error('[HorusAgent] Gathering context with request:', {
            intent: contextRequest.intent,
            budget: contextRequest.budget,
          });
        }

        const contextBundle = await this.contextOrchestrator.gather(contextRequest);

        // Inject context bundle into chat history
        if (contextBundle.sources.length > 0) {
          this.injectContextBundle(contextBundle);

          if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
            console.error('[HorusAgent] Context injected:', {
              sources: contextBundle.sources.length,
              tokens: contextBundle.metadata.tokensUsed,
              cacheHits: contextBundle.metadata.cacheHits,
            });
          }
        }
      } catch (error) {
        console.error('[HorusAgent] Context gathering failed:', error);
        // Continue without context optimization
      }
    }

    // ACT PHASE: Execute agent loop
    try {
      const tools = await getAllHorusTools();
      let currentResponse = await this.horusClient.chat(
        this.messages,
        tools
      );

      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        const assistantMessage = currentResponse.choices[0]?.message;

        if (!assistantMessage) {
          throw new Error("No response from Horus");
        }

        // Fallback: Check if content contains raw JSON tool calls (for models that don't support tool_calls)
        let finalToolCalls = assistantMessage.tool_calls;
        let finalContent = assistantMessage.content;

        if (!finalToolCalls && assistantMessage.content) {
          const parsedToolCalls = this.parseRawToolCalls(
            assistantMessage.content
          );
          if (parsedToolCalls) {
            finalToolCalls = parsedToolCalls;
            finalContent = ""; // Clear content since it was actually tool calls
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

          // Create initial tool call entries to show tools are being executed
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

          // Execute tool calls and update the entries
          for (const toolCall of finalToolCalls) {
            const result = await this.executeTool(toolCall);

            // VERIFY PHASE: Verify tool result if verification enabled
            if (this.verificationPipeline && result.success) {
              try {
                const verificationResult = await this.verificationPipeline.verify({
                  success: result.success,
                  output: result.output || '',
                  filePath: this.extractFilePath(toolCall),
                  operation: this.extractOperation(toolCall.function.name),
                });

                if (!verificationResult.passed) {
                  // Add verification feedback to chat
                  const verificationFeedback = this.formatVerificationFeedback(verificationResult);

                  if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
                    console.error('[HorusAgent] Verification failed:', verificationFeedback);
                  }

                  // Inject system message for LLM
                  this.messages.push({
                    role: "user",
                    content: `⚠️ Verification failed:\n${verificationFeedback}\n\nPlease fix the issues above.`,
                  });

                  // Add to chat history
                  const feedbackEntry: ChatEntry = {
                    type: "assistant",
                    content: `⚠️ Verification issues detected:\n${verificationFeedback}`,
                    timestamp: new Date(),
                  };
                  this.chatHistory.push(feedbackEntry);
                  newEntries.push(feedbackEntry);
                }
              } catch (error) {
                if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
                  console.error('[HorusAgent] Verification error:', error);
                }
                // Continue without verification if error
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

              // Also update in newEntries for return value
              const newEntryIndex = newEntries.findIndex(
                (entry) =>
                  entry.type === "tool_call" &&
                  entry.toolCall?.id === toolCall.id
              );
              if (newEntryIndex !== -1) {
                newEntries[newEntryIndex] = updatedEntry;
              }
            }

            // Add tool result to messages with proper format (needed for AI context)
            this.messages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Get next response - this might contain more tool calls
          currentResponse = await this.horusClient.chat(
            this.messages,
            tools
          );
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
          break; // Exit the loop
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

  /**
   * Parse raw JSON tool calls from content (fallback for models that don't support structured tool_calls)
   * Some models like devstral return tool calls as raw JSON in the content field instead of using tool_calls
   */
  private parseRawToolCalls(content: string): HorusToolCall[] | null {
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
    } catch (error) {
      // Not valid JSON or not a tool call format
      return null;
    }
  }

  async *processUserMessageStream(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();

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

    // GATHER PHASE: Context orchestration (if enabled)
    if (this.contextOrchestrator) {
      try {
        const maxContext = getModelMaxContext(this.currentModel);
        const historyTokens = this.tokenCounter.countTokens(
          JSON.stringify(this.messages)
        );

        const contextRequest: ContextRequest = {
          intent: this.contextOrchestrator.detectIntent(message),
          query: message,
          currentContext: this.chatHistory,
          budget: {
            maxTokens: maxContext,
            reservedForContext: 0.3,
            usedByHistory: historyTokens,
            available: Math.max(0, Math.floor(maxContext * 0.3) - historyTokens),
          },
        };

        if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
          console.error('[HorusAgent] Gathering context with request:', {
            intent: contextRequest.intent,
            budget: contextRequest.budget,
          });
        }

        const contextBundle = await this.contextOrchestrator.gather(contextRequest);

        // Inject context bundle into chat history
        if (contextBundle.sources.length > 0) {
          this.injectContextBundle(contextBundle);

          if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
            console.error('[HorusAgent] Context injected:', {
              sources: contextBundle.sources.length,
              tokens: contextBundle.metadata.tokensUsed,
              cacheHits: contextBundle.metadata.cacheHits,
            });
          }
        }
      } catch (error) {
        console.error('[HorusAgent] Context gathering failed:', error);
        // Continue without context optimization
      }
    }

    const maxToolRounds = this.maxToolRounds; // Prevent infinite loops
    let toolRounds = 0;
    let totalOutputTokens = 0;
    let lastTokenUpdate = 0;

    try {
      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        // Check if operation was cancelled
        if (this.abortController?.signal.aborted) {
          yield {
            type: "content",
            content: "\n\n[Operation cancelled by user]",
          };
          yield { type: "done" };
          return;
        }

        // Stream response and accumulate
        const tools = await getAllHorusTools();
        const stream = this.horusClient.chatStream(
          this.messages,
          tools
        );
        let accumulatedMessage: any = {};
        let accumulatedContent = "";
        let toolCallsYielded = false;
        let contentYielded = false; // Track if we've started yielding content

        for await (const chunk of stream) {
          // Check for cancellation in the streaming loop
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
            // Check if we have at least one complete tool call with a function name
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

          // Stream content as it comes, but only if we haven't detected tool calls yet
          if (chunk.choices[0].delta?.content) {
            accumulatedContent += chunk.choices[0].delta.content;

            // Update token count in real-time including accumulated content and any tool calls
            const currentOutputTokens =
              this.tokenCounter.estimateStreamingTokens(accumulatedContent) +
              (accumulatedMessage.tool_calls
                ? this.tokenCounter.countTokens(
                    JSON.stringify(accumulatedMessage.tool_calls)
                  )
                : 0);
            totalOutputTokens = currentOutputTokens;

            // Only yield content if we haven't yielded tool calls yet
            // (to avoid showing raw JSON before we detect it's tool calls)
            if (!toolCallsYielded) {
              // Check if accumulated content looks like raw tool calls (raw mode format)
              // If response starts with '[', it's almost certainly raw tool calls
              // Normal assistant responses don't start with '['
              const trimmed = accumulatedContent.trim();
              const startsWithBracket = trimmed.startsWith("[");

              // More refined detection:
              // - If it starts with '[' and we have less than 50 chars accumulated, wait
              // - If it starts with '[{' it's definitely tool calls
              // - If it contains '"name"' or '"arguments"' it's tool calls
              const looksLikeToolCalls = startsWithBracket && (
                trimmed.startsWith("[{") ||
                trimmed.includes('"name"') ||
                trimmed.includes('"arguments"') ||
                trimmed.length < 50  // Wait longer if starts with [ to be sure
              );

              // Only yield content if it doesn't look like tool calls
              if (!looksLikeToolCalls) {
                yield {
                  type: "content",
                  content: chunk.choices[0].delta.content,
                };
                contentYielded = true;
              }
            } else if (contentYielded) {
              // If we already started yielding content, continue
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
                tokenCount: inputTokens + totalOutputTokens,
              };
            }
        }
      }

        // Fallback: Check if content contains raw JSON tool calls (for models that don't support tool_calls)
        let finalToolCalls = accumulatedMessage.tool_calls;
        let finalContent = accumulatedMessage.content;

        if (!finalToolCalls && accumulatedMessage.content) {
          const parsedToolCalls = this.parseRawToolCalls(
            accumulatedMessage.content
          );
          if (parsedToolCalls) {
            finalToolCalls = parsedToolCalls;
            finalContent = ""; // Clear content since it was actually tool calls
          }
        }

        // Add assistant entry to history
        const assistantEntry: ChatEntry = {
          type: "assistant",
          content: finalContent || "Using tools to help you...",
          timestamp: new Date(),
          toolCalls: finalToolCalls || undefined,
        };
        this.chatHistory.push(assistantEntry);

        // Add accumulated message to conversation
        this.messages.push({
          role: "assistant",
          content: finalContent || "",
          tool_calls: finalToolCalls,
        } as any);

        // Handle tool calls if present
        if (finalToolCalls?.length > 0) {
          toolRounds++;

          // Only yield tool_calls if we haven't already yielded them during streaming
          if (!toolCallsYielded) {
            yield {
              type: "tool_calls",
              toolCalls: finalToolCalls,
            };
          }

          // Execute tools
          for (const toolCall of finalToolCalls) {
            // Check for cancellation before executing each tool
            if (this.abortController?.signal.aborted) {
              yield {
                type: "content",
                content: "\n\n[Operation cancelled by user]",
              };
              yield { type: "done" };
              return;
            }

            const result = await this.executeTool(toolCall);

            // VERIFY PHASE: Verify tool result if verification enabled
            if (this.verificationPipeline && result.success) {
              try {
                const verificationResult = await this.verificationPipeline.verify({
                  success: result.success,
                  output: result.output || '',
                  filePath: this.extractFilePath(toolCall),
                  operation: this.extractOperation(toolCall.function.name),
                });

                if (!verificationResult.passed) {
                  const verificationFeedback = this.formatVerificationFeedback(verificationResult);

                  if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
                    console.error('[HorusAgent] Verification failed (streaming):', verificationFeedback);
                  }

                  // Inject system message for LLM
                  this.messages.push({
                    role: "user",
                    content: `⚠️ Verification failed:\n${verificationFeedback}\n\nPlease fix the issues above.`,
                  });

                  // Yield verification feedback
                  yield {
                    type: "content",
                    content: `\n\n⚠️ Verification issues:\n${verificationFeedback}\n`,
                  };
                }
              } catch (error) {
                if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
                  console.error('[HorusAgent] Verification error (streaming):', error);
                }
                // Continue without verification if error
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

            // Add tool result with proper format (needed for AI context)
            this.messages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Update token count after processing all tool calls to include tool results
          inputTokens = this.tokenCounter.countMessageTokens(
            this.messages as any
          );
          // Final token update after tools processed
          yield {
            type: "token_count",
            tokenCount: inputTokens + totalOutputTokens,
          };

          // Continue the loop to get the next response (which might have more tool calls)
        } else {
          // No tool calls, we're done
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
      // Check if this was a cancellation
      if (this.abortController?.signal.aborted) {
        yield {
          type: "content",
          content: "\n\n[Operation cancelled by user]",
        };
        yield { type: "done" };
        return;
      }

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
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  private async executeTool(toolCall: HorusToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);

      switch (toolCall.function.name) {
        case "view_file":
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          return await this.textEditor.view(args.path, range);

        case "create_file":
          return await this.textEditor.create(args.path, args.content);

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str,
            args.replace_all
          );

        case "replace_lines":
          return await this.textEditor.replaceLines(
            args.path,
            args.start_line,
            args.end_line,
            args.new_content
          );

        case "edit_file":
          if (!this.morphEditor) {
            return {
              success: false,
              error:
                "Morph Fast Apply not available. Please set MORPH_API_KEY environment variable to use this feature.",
            };
          }
          return await this.morphEditor.editFile(
            args.target_file,
            args.instructions,
            args.code_edit
          );

        case "bash":
          return await this.bash.execute(args.command);

        case "create_todo_list":
          return await this.todoTool.createTodoList(args.todos);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(args.updates);

        case "search":
          return await this.search.search(args.query, {
            searchType: args.search_type,
            includePattern: args.include_pattern,
            excludePattern: args.exclude_pattern,
            caseSensitive: args.case_sensitive,
            wholeWord: args.whole_word,
            regex: args.regex,
            maxResults: args.max_results,
            fileTypes: args.file_types,
            includeHidden: args.include_hidden,
          });

        default:
          // Check if this is an MCP tool
          if (toolCall.function.name.startsWith("mcp__")) {
            return await this.executeMCPTool(toolCall);
          }

          return {
            success: false,
            error: `Unknown tool: ${toolCall.function.name}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  private async executeMCPTool(toolCall: HorusToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const mcpManager = getMCPManager();

      const result = await mcpManager.callTool(toolCall.function.name, args);

      if (result.isError) {
        return {
          success: false,
          error: (result.content[0] as any)?.text || "MCP tool error",
        };
      }

      // Extract content from result
      const output = result.content
        .map((item) => {
          if (item.type === "text") {
            return item.text;
          } else if (item.type === "resource") {
            return `Resource: ${item.resource?.uri || "Unknown"}`;
          }
          return String(item);
        })
        .join("\n");

      return {
        success: true,
        output: output || "Success",
      };
    } catch (error: any) {
      return {
        success: false,
        error: `MCP tool execution error: ${error.message}`,
      };
    }
  }

  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.bash.getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.bash.execute(command);
  }

  getCurrentModel(): string {
    return this.horusClient.getCurrentModel();
  }

  setModel(model: string): void {
    this.horusClient.setModel(model);
    // Update token counter for new model
    this.tokenCounter.dispose();
    this.tokenCounter = createTokenCounter(model);
  }

  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Inject context bundle into chat history
   * Adds relevant context sources as system messages
   */
  private injectContextBundle(bundle: ContextBundle): void {
    if (bundle.sources.length === 0) {
      return;
    }

    // Build context message
    const contextParts: string[] = [
      '=== RELEVANT CONTEXT ===',
      '',
      `Strategy: ${bundle.metadata.strategy}`,
      `Sources: ${bundle.sources.length} files`,
      `Tokens: ${bundle.metadata.tokensUsed}`,
      `Cache hits: ${bundle.metadata.cacheHits || 0}/${bundle.sources.length}`,
      '',
    ];

    // Add each source
    for (const source of bundle.sources) {
      contextParts.push(`--- ${source.path} ---`);

      // Add metadata if available
      if (source.metadata.reasons && source.metadata.reasons.length > 0) {
        contextParts.push(`Relevance: ${source.metadata.reasons.join(', ')}`);
      }
      if (source.lineRange) {
        contextParts.push(
          `Lines: ${source.lineRange.start}-${source.lineRange.end}`
        );
      }

      contextParts.push('');
      contextParts.push(source.content);
      contextParts.push('');
    }

    contextParts.push('=== END CONTEXT ===');

    const contextMessage = contextParts.join('\n');

    // Add as system message to preserve context
    this.messages.push({
      role: 'system',
      content: contextMessage,
    });

    if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
      console.error('[HorusAgent] Context bundle injected into messages');
    }
  }

  /**
   * Get context orchestrator statistics (if enabled)
   */
  getContextStats() {
    return this.contextOrchestrator?.getCacheStats();
  }

  /**
   * Clear context cache (if enabled)
   */
  clearContextCache() {
    this.contextOrchestrator?.clearCache();
  }

  /**
   * Extract file path from tool call
   */
  private extractFilePath(toolCall: HorusToolCall): string | undefined {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      return args.path || args.file_path || args.filePath;
    } catch {
      return undefined;
    }
  }

  /**
   * Extract operation type from tool name
   */
  private extractOperation(toolName: string): 'view' | 'create' | 'str_replace' | 'replace_lines' | 'search' | undefined {
    const operationMap: Record<string, 'view' | 'create' | 'str_replace' | 'replace_lines' | 'search'> = {
      'view_file': 'view',
      'create_file': 'create',
      'str_replace_editor': 'str_replace',
      'replace_lines': 'replace_lines',
      'search_files': 'search',
    };
    return operationMap[toolName];
  }

  /**
   * Format verification feedback for LLM
   */
  private formatVerificationFeedback(verificationResult: any): string {
    const parts: string[] = [];

    if (verificationResult.checks.lint && !verificationResult.checks.lint.passed) {
      parts.push('**Lint issues:**');
      verificationResult.checks.lint.issues.forEach((issue: string) => {
        parts.push(`  - ${issue}`);
      });
    }

    if (verificationResult.checks.tests && !verificationResult.checks.tests.passed) {
      parts.push('\n**Test failures:**');
      parts.push(verificationResult.checks.tests.output);
    }

    if (verificationResult.checks.types && !verificationResult.checks.types.passed) {
      parts.push('\n**Type errors:**');
      verificationResult.checks.types.errors.forEach((error: string) => {
        parts.push(`  - ${error}`);
      });
    }

    return parts.join('\n');
  }
}
