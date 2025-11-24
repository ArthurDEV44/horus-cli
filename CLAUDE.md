# Horus CLI - AI Assistant Development Guide

> **Project**: Horus CLI - An open-source AI agent CLI with advanced context management and tool integration
> **Version**: 0.0.33
> **Last Updated**: 2025-11-24
> **Repository**: https://github.com/ArthurDEV44/horus-cli

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [Codebase Structure](#codebase-structure)
4. [Development Workflows](#development-workflows)
5. [Key Conventions](#key-conventions)
6. [Tool System](#tool-system)
7. [Context Management System](#context-management-system)
8. [Testing Strategy](#testing-strategy)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

### What is Horus CLI?

Horus CLI is a **local-first AI coding assistant** that runs in your terminal, powered by local LLMs (Ollama/Mistral) with an advanced context management system inspired by Claude Code. It implements a sophisticated **gather-act-verify** loop to optimize context retrieval and code generation.

### Key Features

- **🤖 Agentic AI**: Event-driven agent with multi-tool orchestration
- **🧠 Context Management**: Intelligent context gathering with caching, scoring, and subagents
- **🔧 Tool System**: Text editing, bash execution, search, todos, MCP integration
- **⚡ Fast Apply**: Optional Morph API integration for high-speed code editing (4500+ tokens/sec)
- **🔌 MCP Support**: Model Context Protocol for extensible tool integration
- **🌐 Multilingual**: Automatic language detection (French, English, Spanish, etc.)
- **💬 Terminal UI**: Beautiful React (Ink) based interface
- **📊 Telemetry**: Built-in observability for context operations

### Tech Stack

| Component | Technology | Details |
|-----------|-----------|---------|
| **Language** | TypeScript | ES2022 target, strict mode disabled |
| **Runtime** | Node.js 18+ / Bun | Bun preferred for speed |
| **CLI** | Commander.js | Sub-commands and flag parsing |
| **UI** | React 19 + Ink 6 | Terminal-based React rendering |
| **AI/LLM** | OpenAI SDK + Ollama | Local model execution |
| **MCP** | @modelcontextprotocol/sdk | stdio/http/sse transports |
| **Search** | ripgrep-node | Fast file search |
| **Caching** | lru-cache | TTL-based with file watching |
| **Testing** | Bun test | Native Bun test runner |
| **Build** | tsc | TypeScript compiler |

---

## Architecture & Design Patterns

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              HorusAgent (Main Orchestrator)                 │
│  - Event-driven architecture (EventEmitter)                 │
│  - Message history & chat state management                  │
│  - Tool execution loop (max 400 rounds)                     │
│  - Coordinates modular components via:                      │
│    • ToolExecutor (executes tools)                          │
│    • StreamingManager (handles streaming)                   │
│    • MessageParser (formats messages)                       │
│    • ContextIntegrator (injects context)                    │
│    • GatherPhase (Phase 1: gather context)                  │
│    • VerifyPhase (Phase 3: validate changes)                │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼───────┐ ┌────▼──────┐ ┌──────▼────────┐
│ GATHER Phase  │ │ ACT Phase │ │ VERIFY Phase  │
│ (GatherPhase) │ │(ToolExec) │ │(VerifyPhase)  │
└───────┬───────┘ └────┬──────┘ └──────┬────────┘
        │              │               │
┌───────▼──────────────▼───────────────▼────────┐
│         ContextOrchestrator (Native)          │
│  - Intent detection (explain/refactor/debug)  │
│  - Context gathering strategies               │
│  - Cache management (LRU + file watching)     │
│  - Subagent spawning (max 3 parallel)         │
└───────────────────────┬───────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼─────┐ ┌──────▼────────┐
│ SearchToolV2 │ │ SubagentMgr│ │ ContextCache  │
│ (Scoring)    │ │ (Parallel) │ │ (LRU + TTL)   │
└──────────────┘ └────────────┘ └───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼─────┐ ┌──────▼────────┐
│   Tools      │ │ HorusClient│ │ Verification  │
│ (6+ tools)   │ │ (OpenAI)   │ │ (Lint/Test)   │
└──────────────┘ └────────────┘ └───────────────┘
```

### Design Patterns

#### 1. Event-Driven Agent
```typescript
// HorusAgent extends EventEmitter for reactive updates
class HorusAgent extends EventEmitter {
  // Emits events: 'start', 'content', 'tool_call', 'tool_result', 'done'
  processUserMessage(message: string): Promise<void> {
    this.emit('start');
    // ... gather → act → verify
    this.emit('done');
  }
}
```

#### 2. Singleton Services
```typescript
// Prevent duplicate instances of global services
const settingsManager = getSettingsManager();     // Singleton
const confirmationService = ConfirmationService.getInstance(); // Singleton
const contextCache = getContextCache();           // Singleton
const mcpManager = getMCPManager();              // Singleton
```

#### 3. Modular Component Pattern
```typescript
// HorusAgent delegates to specialized components
class HorusAgent extends EventEmitter {
  private toolExecutor: ToolExecutor;        // Tool execution
  private streamingManager: StreamingManager; // Streaming responses
  private messageParser: MessageParser;       // Message formatting
  private contextIntegrator: ContextIntegrator; // Context injection
  private gatherPhase: GatherPhase;          // GATHER phase
  private verifyPhase: VerifyPhase;          // VERIFY phase

  // All phases (gather-act-verify) are now natively integrated
  // Previously feature-flagged, now always active
}
```

#### 4. Tool Interface Pattern
```typescript
// All tools implement common interface
interface Tool {
  name: string;
  description: string;
  execute(args: any): Promise<ToolResult>;
}

// ToolResult structure
interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
}
```

#### 5. Gather-Act-Verify Loop
```typescript
async processUserMessage(message: string) {
  // 1. GATHER: Collect relevant context
  if (this.orchestrator) {
    const bundle = await this.orchestrator.gather({ query: message });
    this.injectContextBundle(bundle);
  }

  // 2. ACT: Execute tools via LLM
  const response = await this.horusClient.chat(this.messages);
  await this.executeToolCalls(response.toolCalls);

  // 3. VERIFY: Validate changes
  if (this.verifier) {
    const result = await this.verifier.verify(toolResult);
    if (!result.passed) {
      // Inject feedback for LLM to fix
    }
  }
}
```

---

## Codebase Structure

### Directory Layout

```
horus-cli/
├── src/                          # Source code (TypeScript)
│   ├── index.ts                  # CLI entry point (520+ LOC)
│   ├── agent/                    # Core agent logic (modular architecture)
│   │   ├── horus-agent.ts        # Main orchestrator (705 LOC, refactored)
│   │   ├── index.ts              # Exports
│   │   ├── core/                 # Core functionality modules (787 LOC total)
│   │   │   ├── tool-executor.ts      # Tool execution (172 LOC)
│   │   │   ├── streaming-manager.ts  # Streaming responses (218 LOC)
│   │   │   ├── message-parser.ts     # Message formatting (135 LOC)
│   │   │   ├── context-integrator.ts # Context injection (107 LOC)
│   │   │   └── system-prompt.ts      # System prompt builder (155 LOC)
│   │   └── phases/               # Phase implementations (143 LOC total)
│   │       ├── gather-phase.ts       # GATHER phase (63 LOC)
│   │       └── verify-phase.ts       # VERIFY phase (80 LOC)
│   ├── commands/                 # CLI commands
│   │   ├── context.ts            # Context telemetry CLI (174 LOC)
│   │   └── mcp.ts                # MCP server management
│   ├── context/                  # Context orchestration (Phase 1-4)
│   │   ├── orchestrator.ts       # Context gathering (909 LOC)
│   │   ├── cache.ts              # LRU cache + file watching (371 LOC)
│   │   ├── verification.ts       # Lint/test verification (451 LOC)
│   │   ├── snippet-builder.ts    # Code compression (392 LOC)
│   │   └── subagent-manager.ts   # Parallel execution (366 LOC)
│   ├── tools/                    # Tool implementations
│   │   ├── text-editor.ts        # File operations (983 LOC)
│   │   ├── search.ts             # Content search (594 LOC)
│   │   ├── search-v2.ts          # Enhanced search (564 LOC)
│   │   ├── bash.ts               # Shell execution (384 LOC)
│   │   ├── morph-editor.ts       # Fast Apply (392 LOC)
│   │   ├── todo-tool.ts          # Todo management (153 LOC)
│   │   └── confirmation-tool.ts  # User confirmations (85 LOC)
│   ├── horus/                    # Model/client wrappers
│   │   ├── client.ts             # OpenAI SDK wrapper
│   │   ├── tools.ts              # Tool definitions + MCP
│   │   └── model-configs.ts      # Model-specific configs
│   ├── mcp/                      # Model Context Protocol
│   │   ├── client.ts             # MCP client manager
│   │   ├── config.ts             # Config loader
│   │   └── transports.ts         # stdio/http/sse
│   ├── ui/                       # Terminal UI (React/Ink)
│   │   ├── components/           # 19 React components
│   │   │   ├── modern-chat-interface.tsx
│   │   │   ├── context-bundle-panel.tsx
│   │   │   ├── context-status-panel.tsx
│   │   │   └── ... (16 more)
│   │   ├── theme/
│   │   │   └── design-system.ts
│   │   └── app.tsx
│   ├── utils/                    # Utility modules
│   │   ├── settings-manager.ts   # User & project settings
│   │   ├── token-counter.ts      # Token estimation
│   │   ├── confirmation-service.ts # User confirmations
│   │   ├── context-telemetry.ts  # Metrics collection
│   │   ├── model-config.ts       # Model configuration
│   │   ├── system-info.ts        # System detection (VRAM/RAM)
│   │   ├── custom-instructions.ts # Custom user instructions
│   │   └── text-utils.ts         # Text formatting utilities
│   └── types/                    # TypeScript definitions
│       ├── context.ts            # Context system types (263 LOC)
│       └── index.ts              # General types
├── tests/                        # Test suite (Bun)
│   ├── context-cache.spec.ts
│   ├── context-orchestrator.spec.ts
│   ├── verification-pipeline.spec.ts
│   ├── search-v2.spec.ts
│   ├── snippet-builder.spec.ts
│   ├── subagent-manager.spec.ts
│   ├── context-telemetry.spec.ts
│   ├── model-selector.spec.ts    # Model selection tests
│   └── system-info.spec.ts       # System detection tests
├── docs/                         # Documentation
│   ├── telemetry-api.md
│   └── subagent-architecture.md
├── scripts/                      # Utility scripts
│   └── ... (test runners)
├── .horus/                       # Horus settings
│   └── settings.json
├── package.json
├── tsconfig.json
├── .eslintrc.js
├── README.md                     # User documentation (French)
├── ROADMAP.md                    # Implementation roadmap
├── TODO.md                       # Phase tracking
└── CLAUDE.md                     # This file
```

### Key Modules

#### Core Agent (`src/agent/horus-agent.ts`)
- **Purpose**: Main orchestration engine (refactored to 705 LOC)
- **Responsibilities**:
  - Manages chat history and message state
  - Coordinates modular components (ToolExecutor, StreamingManager, etc.)
  - Orchestrates gather-act-verify loop (up to 400 rounds)
  - Token counting and budget management
- **Key Methods**:
  - `processUserMessage()`: Main processing loop
  - `executeToolCall()`: Delegates to ToolExecutor
  - **Architecture**: Now delegates to specialized components instead of monolithic implementation

#### Agent Core Modules (`src/agent/core/`)

**ToolExecutor** (`tool-executor.ts` - 172 LOC)
- **Purpose**: Centralized tool execution
- **Responsibilities**: Execute all built-in and MCP tools, parse arguments, handle errors
- **Key Methods**: `executeTool()`, `executeMCPTool()`

**StreamingManager** (`streaming-manager.ts` - 218 LOC)
- **Purpose**: Handles streaming responses from LLM
- **Responsibilities**: Process streaming chunks, emit events, manage state
- **Key Methods**: `handleStreamingResponse()`, `emitChunk()`

**MessageParser** (`message-parser.ts` - 135 LOC)
- **Purpose**: Message formatting and parsing
- **Responsibilities**: Format verification feedback, extract file paths, parse operations
- **Key Methods**: `formatVerificationFeedback()`, `extractFilePath()`

**ContextIntegrator** (`context-integrator.ts` - 107 LOC)
- **Purpose**: Context bundle injection
- **Responsibilities**: Build context requests with budget management, inject context into messages
- **Key Methods**: `buildContextRequest()`, `injectContextBundle()`

**SystemPrompt** (`system-prompt.ts` - 155 LOC)
- **Purpose**: System prompt generation
- **Responsibilities**: Build comprehensive system prompt with multilingual support
- **Key Functions**: `buildSystemPrompt(options)`

#### Agent Phase Modules (`src/agent/phases/`)

**GatherPhase** (`gather-phase.ts` - 63 LOC)
- **Purpose**: GATHER phase of gather-act-verify loop
- **Responsibilities**: Orchestrate context gathering via ContextOrchestrator
- **Key Methods**: `gather()`, `getCacheStats()`, `clearCache()`

**VerifyPhase** (`verify-phase.ts` - 80 LOC)
- **Purpose**: VERIFY phase of gather-act-verify loop
- **Responsibilities**: Validate tool execution results (lint, tests, types)
- **Key Methods**: `verify()`, format verification feedback

#### Context Orchestrator (`src/context/orchestrator.ts`)
- **Purpose**: Intelligent context gathering
- **Responsibilities**:
  - Intent detection (explain, refactor, debug, implement, search)
  - Context strategy selection (agentic search, enhanced search, subagents)
  - Budget management (default 30% of context window)
  - Cache coordination
- **Key Methods**:
  - `gather()`: Main context gathering
  - `detectIntent()`: Intent classification
  - `enhancedSearch()`: SearchToolV2 integration
  - `executeWithSubagents()`: Parallel subagent spawning

#### Context Cache (`src/context/cache.ts`)
- **Purpose**: LRU cache with file watching
- **Features**:
  - TTL: 5 minutes default
  - File watching via chokidar
  - Dependency graph for cascade invalidation
  - Hit rate tracking
- **Key Methods**:
  - `get()` / `set()`: Cache operations
  - `invalidate()`: Manual invalidation
  - `invalidateImporters()`: Cascade invalidation

#### Tools System (`src/tools/`)
All tools implement the `Tool` interface:

1. **TextEditorTool**: File operations (view, create, str_replace, replace_lines)
2. **SearchTool / SearchToolV2**: File and content search with scoring
3. **BashTool**: Shell command execution
4. **MorphEditorTool**: Fast Apply via Morph API
5. **TodoTool**: Todo management
6. **ConfirmationTool**: User confirmations

---

## Development Workflows

### Initial Setup

```bash
# Clone repository
git clone <repository>
cd horus-cli

# Install dependencies (prefer pnpm/bun)
pnpm install  # or: bun install

# Build
pnpm run build

# Link globally (for testing)
bun link
```

### Development Cycle

```bash
# 1. Start development mode (hot reload with Bun)
bun run dev

# 2. Or with Node + tsx
npm run dev:node

# 3. Type checking (no emit)
npm run typecheck

# 4. Linting
npm run lint

# 5. Run tests
bun test

# 6. Build for distribution
npm run build
```

### Testing Workflow

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/context-cache.spec.ts

# Run with watch mode
bun test --watch

# Current test coverage:
# - context-cache.spec.ts: 11 tests
# - context-orchestrator.spec.ts: 17 tests
# - verification-pipeline.spec.ts: 21 tests
# - search-v2.spec.ts: 13 tests
# - snippet-builder.spec.ts: 8 tests
# - subagent-manager.spec.ts: 14 tests
# - context-telemetry.spec.ts: 8 tests
# Total: 90+ tests (100% pass rate)
```

### Git Workflow

```bash
# Development happens on 'dev' branch
git checkout dev

# Create feature branch
git checkout -b feature/my-feature

# Commit with conventional commits
git commit -m "feat(context): add new scoring strategy"
git commit -m "fix(agent): resolve streaming timeout issue"
git commit -m "docs(readme): update context system docs"

# Push to dev branch
git push origin dev

# Merge to main via PR
```

### Debug Mode Testing

```bash
# Test with full debug logging
HORUS_CONTEXT_DEBUG=true bun run dev

# Test with thorough verification mode
HORUS_VERIFY_MODE=thorough bun run dev

# Test with both
HORUS_CONTEXT_DEBUG=true \
HORUS_VERIFY_MODE=thorough \
bun run dev
```

**Note**: Depuis l'intégration native (post-Phase 5), toutes les fonctionnalités sont activées par défaut. Les feature flags ont été retirés.

---

## Key Conventions

### Code Style

#### TypeScript Conventions

```typescript
// ✅ Good: Use explicit imports with .js extension (ESM)
import { HorusAgent } from "./agent/horus-agent.js";

// ❌ Bad: No extension
import { HorusAgent } from "./agent/horus-agent";

// ✅ Good: Use fs-extra default import
import fs from "fs-extra";

// ❌ Bad: Namespace import (doesn't work)
import * as fs from "fs-extra";

// ✅ Good: Singleton pattern for services
export function getSettingsManager(): SettingsManager {
  if (!instance) {
    instance = new SettingsManager();
  }
  return instance;
}

// ✅ Good: Feature flags with sensible defaults
const contextMode = process.env.HORUS_CONTEXT_MODE?.toLowerCase() || 'off';

// ✅ Good: Telemetry everywhere
const telemetry = getContextTelemetry();
telemetry.recordMetric({
  operation: 'search',
  duration: Date.now() - startTime,
  tokensEstimated: 1500,
  metadata: { filesScanned: 10 }
});
```

#### Naming Conventions

```typescript
// Files: kebab-case
context-orchestrator.ts
snippet-builder.ts
search-v2.ts

// Classes: PascalCase
class ContextOrchestrator {}
class SubagentManager {}

// Functions: camelCase
function detectIntent() {}
function buildSnippet() {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_SUBAGENTS = 3;
const DEFAULT_TTL = 5 * 60 * 1000;

// Interfaces: PascalCase with 'I' prefix optional
interface ContextRequest {}
interface ToolResult {}

// Types: PascalCase
type IntentType = 'explain' | 'refactor' | 'debug';
```

#### Error Handling

```typescript
// ✅ Good: Try-catch in tool execution
async execute(args: any): Promise<ToolResult> {
  try {
    const result = await this.performOperation(args);
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ✅ Good: Telemetry even on failure
try {
  // ... operation
} catch (error) {
  telemetry.recordMetric({
    operation: 'search',
    duration: Date.now() - startTime,
    metadata: { error: error.message }
  });
  throw error;
}
```

#### Async/Await

```typescript
// ✅ Good: Prefer async/await over promises
async function gather(request: ContextRequest): Promise<ContextBundle> {
  const sources = await this.agenticSearch(request.query);
  return this.buildBundle(sources);
}

// ❌ Bad: Promise chains
function gather(request: ContextRequest): Promise<ContextBundle> {
  return this.agenticSearch(request.query)
    .then(sources => this.buildBundle(sources));
}
```

### File Organization

```typescript
// src/context/orchestrator.ts structure:

// 1. Imports (grouped logically)
import { /* types */ } from "../types/context.js";
import { /* tools */ } from "../tools/index.js";
import { /* utils */ } from "../utils/index.js";

// 2. Type definitions (if not in types/)
interface LocalConfig {}

// 3. Main class
export class ContextOrchestrator {
  // Private properties first
  private cache: ContextCache;

  // Constructor
  constructor(config: OrchestratorConfig) {}

  // Public methods
  async gather() {}

  // Private helper methods
  private detectIntent() {}
}

// 4. Exported helper functions
export function someHelper() {}
```

### Testing Conventions

```typescript
// tests/context-cache.spec.ts

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('ContextCache', () => {
  let cache: ContextCache;

  beforeEach(() => {
    cache = getContextCache();
  });

  afterEach(() => {
    cache.clear();
  });

  it('should cache and retrieve values', () => {
    cache.set('key', value);
    const result = cache.get('key');
    expect(result).toBeDefined();
    expect(result).toBe(value);
  });

  it('should invalidate on TTL expiration', async () => {
    cache.set('key', value, { ttl: 100 });
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(cache.get('key')).toBeUndefined();
  });
});
```

### Environment Variables

```bash
# Debug Flags
HORUS_CONTEXT_DEBUG=true              # Enable context debug logging
HORUS_VERIFY_MODE=fast|thorough       # Verification mode (default: fast)
HORUS_SUBAGENT_MODE=true              # Internal flag (prevents nesting)

# API Configuration
HORUS_API_KEY=your_api_key            # Ollama doesn't need this
HORUS_BASE_URL=http://localhost:11434/v1  # Default Ollama
HORUS_MODEL=mistral-small             # Default model (Phase 5)
MORPH_API_KEY=your_morph_key          # Optional Fast Apply
```

**Note**: Toutes les fonctionnalités des Phases 0-5 sont maintenant intégrées nativement :
- ✅ ContextOrchestrator (Phase 1) - Toujours activé
- ✅ SearchToolV2 + Scoring (Phase 2) - Toujours activé
- ✅ SubagentManager (Phase 3) - Toujours activé
- ✅ VerificationPipeline (Phase 4) - Toujours activé
- ✅ Model Selection (Phase 5) - Intégré

---

## Tool System

### Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  execute(args: any): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
}
```

### Available Tools

#### 1. TextEditorTool (src/tools/text-editor.ts)

**Operations**:
- `view`: View file contents or directory listing
- `create`: Create new file
- `str_replace`: Replace exact string match
- `replace_lines`: Replace line range

**Usage Pattern**:
```typescript
// View file
await textEditor.execute({
  operation: 'view',
  path: 'src/agent/horus-agent.ts'
});

// Edit file
await textEditor.execute({
  operation: 'str_replace',
  path: 'src/agent/horus-agent.ts',
  old_str: 'const max = 100',
  new_str: 'const max = 200'
});
```

**Telemetry**: Tracks all operations (view, create, edit)

#### 2. SearchTool / SearchToolV2 (src/tools/search-v2.ts)

**Features**:
- Multi-pattern glob support
- Scoring strategies: `modified`, `imports`, `fuzzy`
- Return formats: `paths`, `snippets`
- Telemetry integration

**Usage Pattern**:
```typescript
await searchV2.execute({
  patterns: ['*.ts', '!*.spec.ts'],
  scoreBy: 'modified',
  returnFormat: 'snippets',
  maxResults: 10
});
```

#### 3. BashTool (src/tools/bash.ts)

**Features**:
- Shell command execution
- Environment variable support
- Timeout protection
- Working directory management

**Usage Pattern**:
```typescript
await bash.execute({
  command: 'npm test',
  workingDir: '/path/to/project'
});
```

#### 4. MorphEditorTool (src/tools/morph-editor.ts)

**Features**:
- High-speed editing (4500+ tokens/sec)
- Requires `MORPH_API_KEY`
- Abbreviated edit format

**When to use**:
- Complex multi-line edits
- Large refactoring tasks
- When speed is critical

#### 5. TodoTool (src/tools/todo-tool.ts)

**Operations**:
- List todos
- Add todo
- Complete todo
- Clear todos

#### 6. ConfirmationTool (src/tools/confirmation-tool.ts)

**Purpose**: Request user confirmation for dangerous operations

---

## Context Management System

### Overview

The context system implements a sophisticated **gather-act-verify** loop inspired by Claude Code. It's organized in phases:

- **Phase 0**: Telemetry & baseline (✅ Complete)
- **Phase 1**: ContextOrchestrator MVP (✅ Complete)
- **Phase 2**: SearchToolV2 + scoring (✅ Complete)
- **Phase 3**: SubagentManager (✅ Complete)
- **Phase 4**: Verification pipeline (✅ Complete)
- **Phase 5**: Model tuning (⏸️ Pending)

### Architecture Components

#### 1. ContextOrchestrator (src/context/orchestrator.ts)

**Responsibilities**:
- Intent detection: `explain`, `refactor`, `debug`, `implement`, `search`, `general`
- Strategy selection: agentic search, enhanced search, subagents
- Budget management: 30% of context window by default
- Cache coordination

**Configuration**:
```typescript
const orchestrator = new ContextOrchestrator({
  cacheEnabled: true,
  defaultContextPercent: 0.3,  // 30% of context window
  debug: true
});
```

**Intent Detection**:
```typescript
// Detects user intent from query
detectIntent(query: string): IntentType {
  // English patterns
  if (query.includes('explain') || query.includes('what')) return 'explain';
  if (query.includes('refactor') || query.includes('improve')) return 'refactor';
  if (query.includes('fix') || query.includes('debug')) return 'debug';
  if (query.includes('add') || query.includes('implement')) return 'implement';

  // French patterns
  if (query.includes('explique') || query.includes('qu\'est-ce')) return 'explain';
  if (query.includes('refactoriser')) return 'refactor';
  if (query.includes('corriger') || query.includes('réparer')) return 'debug';

  return 'general';
}
```

#### 2. ContextCache (src/context/cache.ts)

**Features**:
- LRU eviction policy
- TTL: 5 minutes default
- File watching (chokidar)
- Dependency graph for cascade invalidation

**Usage**:
```typescript
const cache = getContextCache();

// Set with TTL
cache.set('key', source, { ttl: 5 * 60 * 1000 });

// Get (updates age)
const source = cache.get('key');

// Invalidate
cache.invalidate('src/agent/horus-agent.ts');

// Stats
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}`);
```

#### 3. SearchToolV2 (src/tools/search-v2.ts)

**Scoring Strategies**:

1. **Modified**: Prioritizes recently changed files (git log <7d)
2. **Imports**: Prioritizes files that import the target
3. **Fuzzy**: Levenshtein distance on file names

**Example**:
```typescript
// Enhanced search with scoring
const results = await searchV2.execute({
  patterns: ['src/**/*.ts'],
  scoreBy: 'modified',
  returnFormat: 'snippets',
  maxResults: 5
});

// Results are sorted by score (highest first)
results.forEach(r => {
  console.log(`${r.path} (score: ${r.score})`);
});
```

#### 4. SnippetBuilder (src/context/snippet-builder.ts)

**Purpose**: Reduce token usage via structural compression (no LLM calls)

**Extracts**:
- Export declarations
- Function signatures (sync & async)
- Class declarations
- Interface & type definitions
- Top-level variables
- JSDoc comments (optional)

**Compression Ratio**: ~47-53% (configurable via `maxLines`)

**Example**:
```typescript
const builder = new SnippetBuilder();
const snippet = builder.buildSnippet('src/agent/horus-agent.ts', {
  maxLines: 30,
  includeImports: false,
  includeComments: true
});

console.log(`Original: ${snippet.metadata.originalLines} lines`);
console.log(`Compressed: ${snippet.metadata.importantLines} lines`);
console.log(`Ratio: ${snippet.metadata.compressionRatio}`);
// Output: "Ratio: 0.53" (53% of original size)
```

#### 5. SubagentManager (src/context/subagent-manager.ts)

**Purpose**: Parallel task execution with context isolation

**Constraints**:
- Max 3 concurrent subagents (VRAM limit)
- Isolated contexts (separate HorusAgent instances)
- No nesting (subagents can't spawn subagents)
- Timeout: 60s per subagent

**Pattern Detection**:
```typescript
// Detects parallelizable tasks
detectParallelizableTask(query: string): SubtaskRequest[] | null {
  // Patterns: "all files", "tous les fichiers", "every X"
  if (query.includes('all files') || query.includes('tous les fichiers')) {
    const files = glob.sync('src/**/*.ts');
    return chunkFiles(files, 3); // Split into 3 batches
  }
  return null;
}
```

**Usage**:
```typescript
const manager = new SubagentManager({ maxConcurrent: 3 });

const results = await manager.spawnParallel([
  { files: ['file1.ts', 'file2.ts'], instruction: 'Add error handling' },
  { files: ['file3.ts', 'file4.ts'], instruction: 'Add error handling' },
  { files: ['file5.ts'], instruction: 'Add error handling' }
]);

// Results contain summaries from each subagent
results.forEach(r => console.log(r.summary));
```

#### 6. VerificationPipeline (src/context/verification.ts)

**Purpose**: Post-action validation (gather → act → **verify**)

**Modes**:
- **Fast**: Lint only (2s timeout)
- **Thorough**: Lint + tests + type checking

**Checks**:
1. **Lint**: ESLint on TypeScript files
2. **Tests**: Related test files (opt-in)
3. **Type Check**: tsc --noEmit (opt-in)

**Integration**:
```typescript
// After tool execution
const result = await textEditor.execute({ operation: 'str_replace', ... });

// Verify changes
const verification = await verifier.verify(result, 'fast');

if (!verification.passed) {
  // Inject feedback into LLM context
  this.addSystemMessage(
    `⚠️ Lint errors: ${verification.checks.lint.issues.join(', ')}`
  );
  // LLM will attempt to fix in next iteration
}
```

### Context Telemetry

**Purpose**: Observability and performance tracking

**Operations Tracked**:
- `search`: File and content search
- `view`: File viewing
- `edit`: File modifications
- `create`: File creation
- `verification`: Lint/test checks

**Metrics**:
```typescript
interface ContextMetrics {
  operation: 'search' | 'view' | 'edit' | 'create' | 'verification';
  duration: number;           // Milliseconds
  tokensEstimated?: number;   // Via tiktoken
  metadata: {
    filesScanned?: number;
    filesMatched?: number;
    cacheHit?: boolean;
    strategy?: string;
    [key: string]: any;
  };
}
```

**Usage**:
```typescript
const telemetry = getContextTelemetry();

// Record metric
telemetry.recordMetric({
  operation: 'search',
  duration: 234,
  tokensEstimated: 1500,
  metadata: {
    filesScanned: 10,
    filesMatched: 3,
    strategy: 'agentic-search'
  }
});

// Get snapshot
const snapshot = telemetry.getSnapshot();
console.log(`Total operations: ${snapshot.totalOperations}`);
console.log(`Cache hit rate: ${snapshot.cacheHitRate}`);

// Export to file
await telemetry.exportToJSON('benchmarks/metrics.json');
```

### CLI Commands

```bash
# View telemetry status
horus context status              # Summary
horus context status --last 10    # Last 10 operations
horus context status --json       # JSON output

# Export metrics
horus context export              # Default: telemetry-export.json
horus context export metrics.json # Custom path

# View statistics
horus context stats               # Detailed stats
horus context stats --json        # JSON output

# Clear telemetry
horus context clear               # With confirmation
horus context clear --yes         # Skip confirmation

# Plan context gathering (dry-run)
horus context plan "Explain how SearchTool works"

# Clear cache
horus context clear-cache
horus context clear-cache --yes
```

---

## Testing Strategy

### Test Framework: Bun Test

```bash
# Run all tests
bun test

# Run specific file
bun test tests/context-cache.spec.ts

# Watch mode
bun test --watch
```

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('Feature Name', () => {
  let instance: SomeClass;

  beforeEach(() => {
    instance = new SomeClass();
  });

  afterEach(() => {
    instance.cleanup();
  });

  it('should perform basic operation', () => {
    const result = instance.doSomething();
    expect(result).toBeDefined();
    expect(result.value).toBe(expected);
  });

  it('should handle edge case', () => {
    expect(() => instance.throwError()).toThrow();
  });
});
```

### Current Test Coverage

| Test File | Tests | Focus |
|-----------|-------|-------|
| `context-cache.spec.ts` | 11 | Cache operations, TTL, invalidation |
| `context-orchestrator.spec.ts` | 17 | Intent detection, strategies |
| `verification-pipeline.spec.ts` | 21 | Lint, tests, type checking |
| `search-v2.spec.ts` | 13 | Multi-pattern, scoring |
| `snippet-builder.spec.ts` | 8 | Compression, extraction |
| `subagent-manager.spec.ts` | 14 | Parallel execution, batching |
| `context-telemetry.spec.ts` | 8 | Metrics collection |
| `model-selector.spec.ts` | New | Model selection logic |
| `system-info.spec.ts` | New | VRAM/RAM detection |
| **Total** | **90+** | **100% pass rate** |

### Testing Best Practices

```typescript
// ✅ Good: Test isolation
beforeEach(() => {
  cache.clear();
  telemetry.clear();
});

// ✅ Good: Async testing
it('should complete async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// ✅ Good: Mock external dependencies
it('should handle file not found', async () => {
  const mockFs = { readFileSync: () => { throw new Error('ENOENT'); } };
  // ... test with mock
});

// ✅ Good: Descriptive test names
it('should invalidate cache when file is modified');
it('should return cached result when file unchanged');
it('should cascade invalidation to importers');
```

---

## Common Tasks

### Adding a New Tool

1. **Create tool file**: `src/tools/my-tool.ts`

```typescript
import { ToolResult } from "../types/index.js";

export class MyTool {
  name = "my_tool";
  description = "Description of what this tool does";

  async execute(args: { param: string }): Promise<ToolResult> {
    try {
      // Tool logic here
      const result = await this.performOperation(args.param);

      return {
        success: true,
        output: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async performOperation(param: string): Promise<string> {
    // Implementation
    return "result";
  }
}
```

2. **Export from index**: `src/tools/index.ts`

```typescript
export { MyTool } from "./my-tool.js";
```

3. **Register in HorusAgent**: `src/agent/horus-agent.ts`

```typescript
import { MyTool } from "../tools/index.js";

constructor(...) {
  this.myTool = new MyTool();
}

// Add to tool execution switch
async executeToolCall(toolCall: HorusToolCall) {
  switch (toolCall.function.name) {
    case 'my_tool':
      result = await this.myTool.execute(args);
      break;
  }
}
```

4. **Define in tools schema**: `src/horus/tools.ts`

```typescript
export const HORUS_TOOLS = [
  {
    type: "function",
    function: {
      name: "my_tool",
      description: "Description for LLM",
      parameters: {
        type: "object",
        properties: {
          param: {
            type: "string",
            description: "Parameter description"
          }
        },
        required: ["param"]
      }
    }
  }
];
```

5. **Write tests**: `tests/my-tool.spec.ts`

### Adding Telemetry to a Function

```typescript
import { getContextTelemetry } from "../utils/context-telemetry.js";
import { estimateTokens } from "../utils/token-counter.js";

async function myFunction(args: any) {
  const telemetry = getContextTelemetry();
  const startTime = Date.now();

  try {
    const result = await performOperation(args);

    // Record success
    telemetry.recordMetric({
      operation: 'my_operation',
      duration: Date.now() - startTime,
      tokensEstimated: estimateTokens(result),
      metadata: {
        // Any useful context
        itemsProcessed: result.length
      }
    });

    return result;
  } catch (error) {
    // Record failure
    telemetry.recordMetric({
      operation: 'my_operation',
      duration: Date.now() - startTime,
      metadata: {
        error: error.message
      }
    });

    throw error;
  }
}
```

### Implementing a New Context Strategy

1. **Add strategy type**: `src/types/context.ts`

```typescript
type ContextStrategy =
  | 'agentic-search'
  | 'enhanced-search'
  | 'subagents'
  | 'my-new-strategy'; // Add here
```

2. **Implement in orchestrator**: `src/context/orchestrator.ts`

```typescript
async gather(request: ContextRequest): Promise<ContextBundle> {
  // ... existing strategy selection

  if (someCondition) {
    return await this.myNewStrategy(request);
  }
}

private async myNewStrategy(request: ContextRequest): Promise<ContextBundle> {
  // Strategy implementation
  const sources = await this.collectSources(request);
  return this.buildBundle(sources, {
    strategy: 'my-new-strategy'
  });
}
```

3. **Add tests**: `tests/context-orchestrator.spec.ts`

### Adding a New CLI Command

1. **Add to command file**: `src/commands/context.ts`

```typescript
contextCommand
  .command('my-command')
  .description('Description of command')
  .option('--flag <value>', 'Flag description')
  .action(async (options) => {
    // Command implementation
    console.log('Executing my-command');
  });
```

2. **Test manually**:

```bash
bun run build
bun run start context my-command --flag value
```

---

## Troubleshooting

### Build Errors

```bash
# Error: "Cannot find module"
# Solution: Check .js extension in imports
import { X } from "./module.js"; // ✅ Correct

# Error: "fs.stat is not a function"
# Solution: Use default import for fs-extra
import fs from "fs-extra"; // ✅ Correct
import * as fs from "fs-extra"; // ❌ Wrong
```

### Runtime Errors

```bash
# Error: "Context mode not working"
# Solution: Check environment variable
export HORUS_CONTEXT_MODE=mvp
echo $HORUS_CONTEXT_MODE  # Verify

# Error: "SearchTool returns 0 results"
# Solution: Check searchType in orchestrator
searchType: 'both'  # Search names AND content

# Error: "Cache not invalidating"
# Solution: Check file watcher
# File watcher ignores: node_modules, .git, dist
```

### Test Failures

```bash
# Error: "Tests timeout"
# Solution: Increase timeout in test
it('slow test', async () => {
  // ...
}, { timeout: 10000 }); // 10 seconds

# Error: "Mock not working"
# Solution: Ensure proper cleanup
afterEach(() => {
  // Reset mocks
  jest.restoreAllMocks();
});
```

### Debug Logging

```bash
# Enable all debug logging
export HORUS_CONTEXT_DEBUG=true
export HORUS_VERIFY_ENABLED=true

# Run with debug output
bun run dev

# Check telemetry in stderr
# [CONTEXT] 🔍 search | 150ms | ~2500 tokens
```

---

## Performance Optimization

### System Detection

```typescript
// Auto-detect system capabilities for optimal model selection
import { detectAvailableVRAM, getSystemInfo } from "../utils/system-info.js";
import { getCurrentModel } from "../utils/model-config.js";

// Detect VRAM (supports NVIDIA, AMD, Apple Silicon)
const vramGB = await detectAvailableVRAM(); // Returns GB

// Get full system snapshot
const sysInfo = await getSystemInfo();
console.log(`VRAM: ${sysInfo.vram}GB, RAM: ${sysInfo.ram}GB`);
console.log(`GPU: ${sysInfo.gpuType} - ${sysInfo.gpuName}`);

// Strategy:
// 1. Try nvidia-smi (NVIDIA GPUs)
// 2. Try rocm-smi (AMD GPUs)
// 3. Try system_profiler (Apple Silicon)
// 4. Fallback: estimate from system RAM (conservative 50%)
```

### Context Window Management

```typescript
// Detect model context window
import { getModelMaxContext } from "../horus/model-configs.js";

const maxContext = getModelMaxContext('devstral:24b'); // 128000 tokens
const budget = maxContext * 0.3; // 30% for context

// Adjust based on detected VRAM
// <8GB: 4K context
// 8-16GB: 8K context
// 16-32GB: 32K context
// 32GB+: 128K context
```

### Cache Optimization

```typescript
// Increase cache size for large projects
const cache = getContextCache({
  max: 200,        // Default: 100
  ttl: 10 * 60 * 1000  // 10 minutes (default: 5)
});

// Monitor hit rate
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}`);
// Target: >50% hit rate
```

### Snippet Compression

```typescript
// Adjust maxLines for more compression
const snippet = builder.buildSnippet(path, {
  maxLines: 10,  // More aggressive (47% size)
  maxLines: 30,  // Less aggressive (65% size)
});

// Exclude unnecessary elements
const snippet = builder.buildSnippet(path, {
  includeImports: false,  // Skip imports
  includeComments: false  // Skip JSDoc
});
```

### Subagent Optimization

```typescript
// Limit concurrent subagents based on VRAM
const manager = new SubagentManager({
  maxConcurrent: detectVRAM() > 16 ? 3 : 2
});

// Use smaller context windows for subagents
const subagent = new HorusAgent(apiKey, baseURL, model, 50); // 50 rounds vs 400
```

---

## Project Status

### Implementation Progress

- ✅ **Phase 0**: Telemetry & baseline (100%)
- ✅ **Phase 1**: ContextOrchestrator MVP (100%)
- ✅ **Phase 2**: SearchToolV2 + scoring (100%)
- ✅ **Phase 3**: SubagentManager (100%)
- ✅ **Phase 4**: Verification + UX CLI (100%)
- ⏸️ **Phase 5**: Model tuning (60% - in progress)
  - ✅ System detection (VRAM/RAM/CPU via `system-info.ts`)
  - ✅ Model configuration management (`model-config.ts`)
  - ✅ Settings manager integration
  - ⏸️ Adaptive model selection (pending)
  - ⏸️ Benchmark suite (pending)
- ✅ **Refactoring**: Modular agent architecture (100%)
  - Extracted `horus-agent.ts` into 7 specialized modules
  - Created `agent/core/` and `agent/phases/` directories
  - Reduced main agent from 1200+ LOC to 705 LOC

### Next Steps

1. **Phase 5 Completion**: Adaptive model selection
   - Implement auto-detection workflow (VRAM → optimal model)
   - Create benchmark suite for model performance
   - Finalize default model selection logic

2. **Future Enhancements**:
   - MCP server templates
   - Persistent conversation summaries
   - Custom project heuristics
   - Web telemetry dashboard

### Known Issues

- None currently blocking development

### Contributing

1. Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
2. Write tests for new features
3. Update documentation (README.md, CLAUDE.md)
4. Ensure `bun test` passes (100%)
5. Ensure `bun run build` succeeds
6. Test with feature flags enabled/disabled

---

## Resources

### Documentation
- [README.md](./README.md) - User documentation (French)
- [ROADMAP.md](./ROADMAP.md) - Implementation roadmap
- [TODO.md](./TODO.md) - Phase tracking
- [docs/telemetry-api.md](./docs/telemetry-api.md) - Telemetry API
- [docs/subagent-architecture.md](./docs/subagent-architecture.md) - Subagent design

### External References
- [Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code)
- [Ollama Models](https://ollama.com/library/mistral)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

**Last Updated**: 2025-11-24
**Maintained By**: Claude Code + Horus CLI Team
**License**: MIT
