import { HorusToolCall } from "../../horus/client.js";
import { ToolResult } from "../../types/index.js";
import {
  TextEditorTool,
  MorphEditorTool,
  BashTool,
  TodoTool,
  SearchTool,
  GlobTool,
  GrepTool,
  LsTool,
  MultiEditTool,
  WebFetchTool,
  WebSearchTool,
  EnterPlanModeTool,
  ExitPlanModeTool,
  AskUserQuestionTool,
} from "../../tools/index.js";
import { getMCPManager } from "../../horus/tools.js";
import { getPlanningModeService } from "../../utils/planning-mode-service.js";

// Tools that are blocked in planning mode (write operations)
const WRITE_TOOLS = new Set([
  "create_file",
  "str_replace_editor",
  "replace_lines",
  "edit_file",
  "multi_edit",
  "bash",
  "create_todo_list",
  "update_todo_list",
]);

/**
 * ToolExecutor - Handles execution of all tools (built-in and MCP)
 *
 * Responsibilities:
 * - Execute built-in tools (text editor, bash, search, etc.)
 * - Execute MCP tools
 * - Parse tool arguments and handle errors
 */
export class ToolExecutor {
  private planningService = getPlanningModeService();

  constructor(
    private textEditor: TextEditorTool,
    private morphEditor: MorphEditorTool | null,
    private bash: BashTool,
    private todoTool: TodoTool,
    private search: SearchTool,
    private glob: GlobTool,
    private grep: GrepTool,
    private ls: LsTool,
    private multiEdit: MultiEditTool,
    private webFetch: WebFetchTool,
    private webSearch: WebSearchTool,
    private enterPlanMode: EnterPlanModeTool,
    private exitPlanMode: ExitPlanModeTool,
    private askUserQuestion: AskUserQuestionTool
  ) {}

  /**
   * Execute a tool call and return the result
   */
  async executeTool(toolCall: HorusToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const toolName = toolCall.function.name;

      // Block write operations in planning mode (except exit_plan_mode)
      if (this.planningService.isPlanningMode() &&
          WRITE_TOOLS.has(toolName) &&
          toolName !== "exit_plan_mode") {
        return {
          success: false,
          error: `Tool "${toolName}" is blocked in planning mode. Use exit_plan_mode first to enable file modifications.`,
        };
      }

      switch (toolName) {
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

        // Phase 2: Separated Tools
        case "glob":
          return await this.glob.glob(args.pattern, {
            path: args.path,
            ignore: args.ignore,
          });

        case "grep":
          return await this.grep.grep(args.pattern, {
            path: args.path,
            glob: args.glob,
            type: args.type,
            outputMode: args.output_mode,
            contextBefore: args.context_before,
            contextAfter: args.context_after,
            contextAround: args.context_around,
            caseInsensitive: args.case_insensitive,
            multiline: args.multiline,
            headLimit: args.head_limit,
            offset: args.offset,
          });

        case "ls":
          return await this.ls.ls(args.path, {
            ignore: args.ignore,
            all: args.all,
            long: args.long,
            recursive: args.recursive,
            depth: args.depth,
          });

        case "multi_edit":
          return await this.multiEdit.multiEdit(args.file_path, args.edits, {
            dryRun: args.dry_run,
          });

        case "read_todo_list":
          return await this.todoTool.readTodoList({
            status: args.status,
            priority: args.priority,
          });

        // Phase 3: Web Tools
        case "web_fetch":
          return await this.webFetch.fetch(args.url, {
            prompt: args.prompt,
          });

        case "web_search":
          return await this.webSearch.search(args.query, {
            allowedDomains: args.allowed_domains,
            blockedDomains: args.blocked_domains,
            maxResults: args.max_results,
          });

        // Phase 5: Planning Mode Tools
        case "enter_plan_mode":
          return await this.enterPlanMode.execute({
            planFile: args.plan_file,
          });

        case "exit_plan_mode":
          return await this.exitPlanMode.execute();

        case "ask_user_question":
          return await this.askUserQuestion.execute({
            questions: args.questions,
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

  /**
   * Execute an MCP tool
   */
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

  /**
   * Get the current bash directory
   */
  getCurrentDirectory(): string {
    return this.bash.getCurrentDirectory();
  }

  /**
   * Execute a bash command directly
   */
  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.bash.execute(command);
  }
}
