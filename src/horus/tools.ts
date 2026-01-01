import { HorusTool } from "./client.js";
import { MCPManager, MCPTool } from "../mcp/client.js";
import { loadMCPConfig } from "../mcp/config.js";

const BASE_HORUS_TOOLS: HorusTool[] = [
  {
    type: "function",
    function: {
      name: "view_file",
      description: "View contents of a file or list directory contents. By default, shows all lines for files ≤100 lines, or first 50 lines for larger files. Use start_line and end_line parameters to view specific line ranges.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to file or directory to view",
          },
          start_line: {
            type: "number",
            description:
              "Starting line number (1-based) for partial file view. Use this with end_line to see specific sections of large files.",
          },
          end_line: {
            type: "number",
            description: "Ending line number (1-based, inclusive) for partial file view. Use this with start_line to see specific sections of large files.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Create a new file with specified content",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path where the file should be created",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "str_replace_editor",
      description: "Replace specific text in a file. Best for single-line or small text replacements where you know the exact text. If str_replace_editor fails with 'String not found', use replace_lines instead.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to edit",
          },
          old_str: {
            type: "string",
            description:
              "Text to replace (must match exactly, or will use fuzzy matching for multi-line strings). If this fails, use replace_lines instead.",
          },
          new_str: {
            type: "string",
            description: "Text to replace with",
          },
          replace_all: {
            type: "boolean",
            description:
              "Replace all occurrences (default: false, only replaces first occurrence)",
          },
        },
        required: ["path", "old_str", "new_str"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_lines",
      description: "Replace a range of lines in a file. Use this when str_replace_editor fails because the exact text doesn't match, or when you need to replace multiple lines. This tool works by line numbers, which are more reliable than exact text matching.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to edit",
          },
          start_line: {
            type: "number",
            description: "Starting line number (1-based) of the range to replace",
          },
          end_line: {
            type: "number",
            description: "Ending line number (1-based) of the range to replace (inclusive)",
          },
          new_content: {
            type: "string",
            description: "New content to replace the lines with. Can be multiple lines separated by newlines.",
          },
        },
        required: ["path", "start_line", "end_line", "new_content"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "bash",
      description: "Execute a bash command",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description:
        "Unified search tool for finding text content or files (similar to Cursor's search)",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Text to search for or file name/path pattern",
          },
          search_type: {
            type: "string",
            enum: ["text", "files", "both"],
            description:
              "Type of search: 'text' for content search, 'files' for file names, 'both' for both (default: 'both')",
          },
          include_pattern: {
            type: "string",
            description:
              "Glob pattern for files to include (e.g. '*.ts', '*.js')",
          },
          exclude_pattern: {
            type: "string",
            description:
              "Glob pattern for files to exclude (e.g. '*.log', 'node_modules')",
          },
          case_sensitive: {
            type: "boolean",
            description:
              "Whether search should be case sensitive (default: false)",
          },
          whole_word: {
            type: "boolean",
            description: "Whether to match whole words only (default: false)",
          },
          regex: {
            type: "boolean",
            description: "Whether query is a regex pattern (default: false)",
          },
          max_results: {
            type: "number",
            description: "Maximum number of results to return (default: 50)",
          },
          file_types: {
            type: "array",
            items: { type: "string" },
            description: "File types to search (e.g. ['js', 'ts', 'py'])",
          },
          include_hidden: {
            type: "boolean",
            description: "Whether to include hidden files (default: false)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_todo_list",
      description: "Create a new todo list for planning and tracking tasks",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "Array of todo items",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Unique identifier for the todo item",
                },
                content: {
                  type: "string",
                  description: "Description of the todo item",
                },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "Current status of the todo item",
                },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "Priority level of the todo item",
                },
              },
              required: ["id", "content", "status", "priority"],
            },
          },
        },
        required: ["todos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_todo_list",
      description: "Update existing todos in the todo list",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            description: "Array of todo updates",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "ID of the todo item to update",
                },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "New status for the todo item",
                },
                content: {
                  type: "string",
                  description: "New content for the todo item",
                },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "New priority for the todo item",
                },
              },
              required: ["id"],
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  // Phase 2: Separated Tools
  {
    type: "function",
    function: {
      name: "glob",
      description: "Fast file pattern matching tool. Find files matching glob patterns (e.g. '**/*.ts', 'src/**/*.tsx'). Returns matching file paths sorted by modification time (most recent first).",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Glob pattern to match files against (e.g. '**/*.ts', 'src/**/*.tsx', '*.json')",
          },
          path: {
            type: "string",
            description: "Directory to search in. Defaults to current working directory if not specified.",
          },
          ignore: {
            type: "array",
            items: { type: "string" },
            description: "Additional patterns to ignore (node_modules, .git, dist are ignored by default)",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description: "Search file contents with regex patterns (ripgrep-like). Supports multiple output modes and context lines.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Regular expression pattern to search for in file contents",
          },
          path: {
            type: "string",
            description: "File or directory to search in. Defaults to current working directory.",
          },
          glob: {
            type: "string",
            description: "Glob pattern to filter files (e.g. '*.ts', '**/*.tsx')",
          },
          type: {
            type: "string",
            description: "File type to search (e.g. 'js', 'ts', 'py', 'rust', 'go'). More efficient than glob for standard types.",
          },
          output_mode: {
            type: "string",
            enum: ["content", "files_with_matches", "count"],
            description: "Output format: 'content' shows matching lines, 'files_with_matches' shows file paths only (default), 'count' shows match counts per file",
          },
          context_before: {
            type: "number",
            description: "Number of lines to show before each match (like grep -B)",
          },
          context_after: {
            type: "number",
            description: "Number of lines to show after each match (like grep -A)",
          },
          context_around: {
            type: "number",
            description: "Number of lines to show before and after each match (like grep -C). Overrides context_before and context_after.",
          },
          case_insensitive: {
            type: "boolean",
            description: "Case insensitive search (like grep -i). Default: false",
          },
          multiline: {
            type: "boolean",
            description: "Enable multiline mode where patterns can span lines. Default: false",
          },
          head_limit: {
            type: "number",
            description: "Limit output to first N entries",
          },
          offset: {
            type: "number",
            description: "Skip first N entries before applying head_limit",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ls",
      description: "List directory contents with optional details and filtering. Respects common ignore patterns.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to list. Defaults to current working directory.",
          },
          ignore: {
            type: "array",
            items: { type: "string" },
            description: "Additional patterns to ignore",
          },
          all: {
            type: "boolean",
            description: "Include hidden files (starting with '.'). Default: false",
          },
          long: {
            type: "boolean",
            description: "Long format with details (permissions, size, date). Default: false",
          },
          recursive: {
            type: "boolean",
            description: "Recursive listing. Default: false",
          },
          depth: {
            type: "number",
            description: "Maximum recursion depth when recursive is true. Default: 1",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "multi_edit",
      description: "Apply multiple edits to a single file atomically. All edits succeed or all fail (rollback on error). Each old_string must be unique in the file.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Path to the file to edit",
          },
          edits: {
            type: "array",
            description: "Array of edits to apply in order",
            items: {
              type: "object",
              properties: {
                old_string: {
                  type: "string",
                  description: "Text to find and replace (must be unique in the file)",
                },
                new_string: {
                  type: "string",
                  description: "Text to replace with",
                },
              },
              required: ["old_string", "new_string"],
            },
          },
          dry_run: {
            type: "boolean",
            description: "Preview changes without applying. Default: false",
          },
        },
        required: ["file_path", "edits"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_todo_list",
      description: "Read the current state of the todo list with optional filtering",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "in_progress", "completed"],
            description: "Filter by status",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Filter by priority",
          },
        },
        required: [],
      },
    },
  },
];

// Morph Fast Apply tool (conditional)
const MORPH_EDIT_TOOL: HorusTool = {
  type: "function",
  function: {
    name: "edit_file",
    description: "Use this tool to make an edit to an existing file.\n\nThis will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.\nWhen writing the edit, you should specify each edit in sequence, with the special comment // ... existing code ... to represent unchanged code in between edited lines.\n\nFor example:\n\n// ... existing code ...\nFIRST_EDIT\n// ... existing code ...\nSECOND_EDIT\n// ... existing code ...\nTHIRD_EDIT\n// ... existing code ...\n\nYou should still bias towards repeating as few lines of the original file as possible to convey the change.\nBut, each edit should contain sufficient context of unchanged lines around the code you're editing to resolve ambiguity.\nDO NOT omit spans of pre-existing code (or comments) without using the // ... existing code ... comment to indicate its absence. If you omit the existing code comment, the model may inadvertently delete these lines.\nIf you plan on deleting a section, you must provide context before and after to delete it. If the initial code is ```code \\n Block 1 \\n Block 2 \\n Block 3 \\n code```, and you want to remove Block 2, you would output ```// ... existing code ... \\n Block 1 \\n  Block 3 \\n // ... existing code ...```.\nMake sure it is clear what the edit should be, and where it should be applied.\nMake edits to a file in a single edit_file call instead of multiple edit_file calls to the same file. The apply model can handle many distinct edits at once.",
    parameters: {
      type: "object",
      properties: {
        target_file: {
          type: "string",
          description: "The target file to modify."
        },
        instructions: {
          type: "string",
          description: "A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit. Use the first person to describe what you are going to do. Use it to disambiguate uncertainty in the edit."
        },
        code_edit: {
          type: "string",
          description: "Specify ONLY the precise lines of code that you wish to edit. NEVER specify or write out unchanged code. Instead, represent all unchanged code using the comment of the language you're editing in - example: // ... existing code ..."
        }
      },
      required: ["target_file", "instructions", "code_edit"]
    }
  }
};

// Function to build tools array conditionally
function buildHorusTools(): HorusTool[] {
  const tools = [...BASE_HORUS_TOOLS];
  
  // Add Morph Fast Apply tool if API key is available
  if (process.env.MORPH_API_KEY) {
    tools.splice(3, 0, MORPH_EDIT_TOOL); // Insert after str_replace_editor
  }
  
  return tools;
}

// Export dynamic tools array
export const HORUS_TOOLS: HorusTool[] = buildHorusTools();

// Global MCP manager instance
let mcpManager: MCPManager | null = null;

export function getMCPManager(): MCPManager {
  if (!mcpManager) {
    mcpManager = new MCPManager();
  }
  return mcpManager;
}

export async function initializeMCPServers(): Promise<void> {
  const manager = getMCPManager();
  const config = loadMCPConfig();
  
  // Store original stderr.write
  const originalStderrWrite = process.stderr.write;
  
  // Temporarily suppress stderr to hide verbose MCP connection logs
  process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    // Filter out mcp-remote verbose logs
    const chunkStr = chunk.toString();
    if (chunkStr.includes('[') && (
        chunkStr.includes('Using existing client port') ||
        chunkStr.includes('Connecting to remote server') ||
        chunkStr.includes('Using transport strategy') ||
        chunkStr.includes('Connected to remote server') ||
        chunkStr.includes('Local STDIO server running') ||
        chunkStr.includes('Proxy established successfully') ||
        chunkStr.includes('Local→Remote') ||
        chunkStr.includes('Remote→Local')
      )) {
      // Suppress these verbose logs
      if (callback) callback();
      return true;
    }
    
    // Allow other stderr output
    return originalStderrWrite.call(this, chunk, encoding, callback);
  };
  
  try {
    for (const serverConfig of config.servers) {
      try {
        await manager.addServer(serverConfig);
      } catch (error) {
        console.warn(`Failed to initialize MCP server ${serverConfig.name}:`, error);
      }
    }
  } finally {
    // Restore original stderr.write
    process.stderr.write = originalStderrWrite;
  }
}

export function convertMCPToolToHorusTool(mcpTool: MCPTool): HorusTool {
  return {
    type: "function",
    function: {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: mcpTool.inputSchema || {
        type: "object",
        properties: {},
        required: []
      }
    }
  };
}

export function addMCPToolsToHorusTools(baseTools: HorusTool[]): HorusTool[] {
  if (!mcpManager) {
    return baseTools;
  }
  
  const mcpTools = mcpManager.getTools();
  const horusMCPTools = mcpTools.map(convertMCPToolToHorusTool);
  
  return [...baseTools, ...horusMCPTools];
}

export async function getAllHorusTools(): Promise<HorusTool[]> {
  const manager = getMCPManager();
  // Try to initialize servers if not already done, but don't block
  manager.ensureServersInitialized().catch(() => {
    // Ignore initialization errors to avoid blocking
  });
  return addMCPToolsToHorusTools(HORUS_TOOLS);
}
