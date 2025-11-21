# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Horus CLI is an AI-powered terminal assistant (package: `@vibe-kit/horus-cli`) that provides conversational AI with file editing capabilities, bash integration, and MCP (Model Context Protocol) tool support. It uses OpenAI-compatible APIs (defaulting to Ollama) for local LLM inference.

## Essential Commands

### Development
```bash
# Install dependencies (uses pnpm by default)
pnpm install
# or: bun install

# Development mode (with Bun - faster)
bun run dev

# Development mode (with Node)
bun run dev:node

# Build TypeScript to dist/
bun run build
# or: pnpm run build

# Type checking
bun run typecheck

# Linting
bun run lint
```

### Running Horus CLI
```bash
# After building, run locally
bun run start

# Or use the CLI directly during development
bun run src/index.ts

# Interactive mode
horus

# Headless mode (single command)
horus --prompt "show me the package.json file"

# With specific model
horus --model devstral:24b

# Git operations
horus git commit-and-push
```

### MCP Management
```bash
# Add MCP server
horus mcp add <name> --transport stdio --command "bun" --args server.js

# List MCP servers
horus mcp list

# Test MCP server
horus mcp test <server-name>

# Remove MCP server
horus mcp remove <server-name>
```

## Architecture

### Core Components

#### 1. Entry Point (`src/index.ts`)
- Sets up Commander.js CLI with main command and subcommands (git, mcp)
- Handles both interactive mode (launches Ink UI) and headless mode (processes single prompt)
- Manages settings via `SettingsManager` (user-level + project-level)
- Supports variadic arguments for multi-word initial messages

#### 2. Agent Layer (`src/agent/horus-agent.ts`)
- **`HorusAgent`**: Main orchestrator that manages the agentic loop
- Maintains chat history and converts between internal `ChatEntry` format and OpenAI message format
- Coordinates all tools (text editor, bash, todo, search, confirmation, optional Morph editor)
- Implements streaming responses via EventEmitter
- Enforces `maxToolRounds` limit (default: 400) to prevent runaway tool loops
- Loads custom instructions from `.horus/HORUS.md` if present

#### 3. LLM Client (`src/horus/client.ts`)
- **`HorusClient`**: OpenAI SDK wrapper configured for Ollama by default
- Supports any OpenAI-compatible API (OpenRouter, Groq, etc.)
- Dynamic context window management via `getModelMaxContext()` (defined in `model-configs.ts`)
- Default model: `devstral:24b` (128K context window)
- Uses temperature 0.2 for deterministic code generation

#### 4. Tools (`src/tools/`)
All tools implement a common pattern with `execute()` method and schema definition:

- **`TextEditorTool`**: Core file operations (view, create, str_replace, replace_lines)
- **`MorphEditorTool`**: Optional high-speed editing via Morph Fast Apply API (4,500+ tokens/sec, requires `MORPH_API_KEY`)
- **`BashTool`**: Execute shell commands with timeout/security controls
- **`SearchTool`**: File search with glob/regex patterns (naive recursive walk, 100 result limit)
- **`TodoTool`**: Manage task lists during sessions
- **`ConfirmationTool`**: User approval for sensitive operations

Tool schemas are converted to Horus format in `src/horus/tools.ts` via `addMCPToolsToHorusTools()`.

#### 5. MCP Integration (`src/mcp/`)
- **`MCPManager`** (`client.ts`): Manages MCP server connections and tool registration
- **Transport layer** (`transports.ts`): Supports stdio, HTTP, and SSE transports
- **Config** (`config.ts`): Loads from `.horus/settings.json`
- MCP tools are prefixed with `mcp__<server>__<tool>` to namespace them

#### 6. Settings Management (`src/utils/settings-manager.ts`)
Two-level settings hierarchy:
- **User settings** (`~/.horus/user-settings.json`): Global preferences (API keys, default model, base URL)
- **Project settings** (`.horus/settings.json`): Project-specific overrides (current model, MCP servers)

Settings priority: Project → User → System defaults

#### 7. UI Layer (`src/ui/`)
Built with Ink (React for CLIs):
- **`ModernChatInterface`** (`components/modern-chat-interface.tsx`): Main interactive UI
- **Components**: Message rendering, diff display, loading spinners, model selection
- **Markdown rendering** (`utils/markdown-renderer.tsx`): Terminal-friendly markdown with syntax highlighting
- **Design system** (`theme/design-system.ts`): Centralized colors and styles

### Data Flow

```
User Input (CLI/Ink)
    ↓
HorusAgent.processUserMessage()
    ↓
HorusClient.chat() → OpenAI-compatible API
    ↓
Response with tool_calls?
    ↓ Yes
Execute tools (TextEditor/Bash/Search/MCP)
    ↓
Feed tool results back → Loop (up to maxToolRounds)
    ↓ No tool_calls
Return final assistant message
```

### Configuration Files

- **`tsconfig.json`**: ES2022 target, ESNext modules, JSX for Ink components, outputs to `dist/`
- **`.horus/settings.json`**: Project-level settings (model selection, MCP servers)
- **`~/.horus/user-settings.json`**: User-global settings (API keys, defaults)
- **`.horus/HORUS.md`**: Optional custom instructions loaded into system prompt

## Key Conventions

### File Editing Strategy
1. **For existing files**: Always prefer `str_replace_editor` for simple text replacements
2. **For multi-line edits**: Use `replace_lines` with line number ranges
3. **For complex refactors** (if MORPH_API_KEY set): Use `edit_file` (Morph Fast Apply)
4. **Never use `create_file` for files that already exist**

### Tool Loop Management
- Agent tracks tool execution rounds to prevent infinite loops
- Default limit: 400 rounds (configurable via `--max-tool-rounds`)
- Headless mode auto-approves all confirmations (`ConfirmationService.setSessionFlag("allOperations", true)`)

### Model Selection
Priority order:
1. `--model` CLI flag
2. `HORUS_MODEL` environment variable
3. Project setting (`.horus/settings.json`)
4. User default (`~/.horus/user-settings.json`)
5. System default (`devstral:24b`)

### Token Budget
- Each model has a max context defined in `src/horus/model-configs.ts`
- Token counting via `tiktoken` library (`src/utils/token-counter.ts`)
- Context window passed to Ollama as `num_ctx` parameter

## Development Notes

### TypeScript Configuration
- **Strict mode**: Disabled (`strict: false`, `noImplicitAny: false`) for rapid prototyping
- **Module system**: ESNext with `"type": "module"` in package.json
- **JSX**: React mode for Ink components
- **Imports**: All imports must include `.js` extension (ES module requirement)

### Error Handling
- Global handlers in `index.ts` catch uncaught exceptions/rejections
- SIGTERM handler restores terminal raw mode before exit
- Confirmation service prevents destructive operations without approval

### Testing Strategy
Currently no automated test suite. When adding tests:
- Focus on tool execution logic (`src/tools/`)
- Test settings manager priority resolution
- Validate MCP transport connections
- Verify tool loop termination conditions

## Future Architecture (Planned)

See `CODEBASE_CONTEXT_PLAN.md` for details on upcoming context orchestration system inspired by Claude Code:
- **ContextPlanner**: Orchestrate search/view operations before each LLM call
- **QueryPlanner**: Heuristic-based file prioritization (imports, tests, extensions)
- **SnippetBuilder**: Compress file content with summaries for context efficiency
- **VerificationAdapters**: Post-action validation (lint, tests, diffs)

This will implement a "gather → act → verify" loop without requiring persistent indexing.

## Common Pitfalls

1. **Import paths**: Always use `.js` extension even for `.ts` files (ESM requirement)
2. **Morph API key**: Optional; gracefully degrade if not set (`process.env.MORPH_API_KEY`)
3. **Ollama requirement**: Default config expects Ollama running at `http://localhost:11434/v1`
4. **MCP server configs**: Stored in project `.horus/settings.json`, not version controlled
5. **Raw mode terminal**: Ink handles Ctrl+C; avoid manual SIGINT handling
6. **WSL2 compatibility**: Application includes error handling for EPERM stdin errors common in WSL2 environments. If you encounter terminal input issues, ensure stdin is properly initialized before Ink starts (handled in `ensureStdinReady()`)

## Resources

- Main README: Comprehensive usage guide in French (`README.md`)
- UI Documentation: Modern interface design notes (`MODERN_UI.md`)
- Context System: Planned architecture for agentic context retrieval (`CODEBASE_CONTEXT_PLAN.md`)
- Benchmarks: Model performance comparisons (`MODELE_CODING_BENCHMARKS.md`)
