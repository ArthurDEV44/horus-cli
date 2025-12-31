# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Development mode (hot reload)
bun run dev

# Build TypeScript to dist/
bun run build

# Run linter
bun run lint

# Type checking only
bun run typecheck

# Run the CLI directly
bun run src/index.ts
node dist/index.js
```

## Architecture Overview

Horus CLI is a conversational AI agent for the terminal, built with TypeScript, React/Ink for the UI, and the OpenAI SDK (compatible with Ollama and other providers).

### Core Components

**Entry Point & CLI** (`src/index.ts`)
- Commander.js-based CLI with options for model, API key, base URL, prompt (headless mode)
- Supports both interactive mode (Ink UI) and headless mode (`--prompt`)
- Subcommands: `git commit-and-push`, `mcp`, `context`, `init`

**HorusAgent** (`src/agent/horus-agent.ts`)
- Main orchestrator implementing a **gather-act-verify loop**
- Manages conversation history, tool execution, and streaming responses
- Delegates to modular components:
  - `ToolExecutor` (`src/agent/core/tool-executor.ts`): Executes all tool calls
  - `StreamingManager` (`src/agent/core/streaming-manager.ts`): Handles streaming responses
  - `ContextIntegrator` (`src/agent/core/context-integrator.ts`): Injects context into messages
  - `GatherPhase` / `VerifyPhase` (`src/agent/phases/`): Context gathering and verification

**HorusClient** (`src/horus/client.ts`)
- OpenAI SDK wrapper configured for Ollama by default (`http://localhost:11434/v1`)
- Supports streaming and non-streaming chat completions with tool calling

**Tools** (`src/tools/`)
- `BashTool`: Shell command execution
- `TextEditorTool`: File viewing, creating, editing with str_replace
- `MorphEditorTool`: Optional fast-apply editing via Morph API
- `SearchTool` / `SearchToolV2`: File and content search with scoring strategies
- `TodoTool`: Task list management
- `ConfirmationTool`: User confirmation dialogs

**Context System** (`src/context/`)
- `ContextOrchestrator`: Central coordinator for intelligent context gathering
- `ContextCache`: LRU cache with file watching for invalidation
- `SnippetBuilder`: Structural compression of files (extracts declarations only)
- `SubagentManager`: Parallel task execution via subagents
- `VerificationPipeline`: Post-edit validation (lint, tests, types)

**UI Layer** (`src/ui/`)
- React/Ink components for terminal UI
- `ModernChatInterface`: Main chat interface component
- Components: chat history, input, status bar, model selection, confirmation dialogs

**MCP Integration** (`src/mcp/`)
- Model Context Protocol client for external tool servers
- Supports stdio, HTTP, and SSE transports

### Configuration Files

- **User settings**: `~/.horus/user-settings.json` (API key, base URL, default model)
- **Project settings**: `.horus/settings.json` (current model, MCP servers)
- **Custom instructions**: `.horus/HORUS.md` (project-specific AI instructions)

### Key Patterns

1. **Tool definitions** are in `src/horus/tools.ts` and follow OpenAI function calling format
2. **Messages** use OpenAI's `ChatCompletionMessageParam` type
3. **Context scoring** uses strategies: `modified` (git recency), `imports` (dependency graph), `fuzzy` (filename matching)
4. **Environment variables**:
   - `HORUS_API_KEY`, `HORUS_BASE_URL`, `HORUS_MODEL`
   - `MORPH_API_KEY` for fast-apply editing
   - `HORUS_CONTEXT_DEBUG=true` for context system logging
   - `HORUS_VERIFY_MODE=thorough` for full verification (lint + tests + types)

### Slash Commands System (`src/commands/slash/`)

Modular slash command system inspired by Claude Code:
- **Built-in commands**: `/help`, `/clear`, `/models`, `/commit`, `/init`, `/config`, `/doctor`, etc.
- **Custom commands**: `.horus/commands/` (project) and `~/.horus/commands/` (user)
- **Frontmatter support**: YAML metadata (description, allowed-tools, model, etc.)
- **Arguments**: `$ARGUMENTS`, `$ARG1`, `$ARG2` substitution
- **Namespacing**: `git/pr.md` → `/git:pr`

### Development Roadmap

See `PLAN.md` at project root for:
- Feature checklist with completion status
- Architecture target
- Implementation priorities
- Code cleanup tasks

### Language Support

The codebase and README are primarily in French. The AI responds in the user's detected language (French, English, Spanish, German, Italian, etc.).
