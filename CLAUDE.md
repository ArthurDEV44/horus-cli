# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
bun install

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

Horus CLI is a conversational AI agent for the terminal, built with TypeScript, React/Ink for the UI, and the OpenAI SDK (compatible with vLLM and other OpenAI-compatible providers).

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
- OpenAI SDK wrapper configured for vLLM by default (`http://localhost:8000/v1`)
- Supports streaming and non-streaming chat completions with tool calling
- Optimized for Mistral AI models with `--tool-call-parser mistral`

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

## Directives d'utilisation des outils MCP

Utilisez les outils Distill MCP pour des opérations économes en tokens :

### Règle 1 : Lecture intelligente de fichiers

Lors de la lecture de fichiers source pour **exploration ou compréhension** :

\`\`\`
mcp__distill__smart_file_read filePath="path/to/file.ts"
\`\`\`

**Quand utiliser Read natif à la place :**
- Avant d'éditer un fichier (Edit nécessite Read d'abord)
- Fichiers de configuration : `.json`, `.yaml`, `.toml`, `.md`, `.env`

### Règle 2 : Compresser les sorties volumineuses

Après les commandes Bash qui produisent une sortie volumineuse (>500 caractères) :

\`\`\`
mcp__distill__auto_optimize content="<collez la sortie volumineuse>"
\`\`\`

### Règle 3 : SDK d'exécution de code pour les opérations complexes

Pour les opérations multi-étapes, utilisez `code_execute` au lieu de plusieurs appels d'outils (**98% d'économie de tokens**) :

\`\`\`
mcp__distill__code_execute code="<code typescript>"
\`\`\`

**API du SDK (`ctx`) :**

*Compression :*
- `ctx.compress.auto(content, hint?)` - Détection auto et compression
- `ctx.compress.logs(logs)` - Résumer les logs
- `ctx.compress.diff(diff)` - Compresser les git diff
- `ctx.compress.semantic(content, ratio?)` - Compression TF-IDF

*Code :*
- `ctx.code.parse(content, lang)` - Parser en structure AST
- `ctx.code.extract(content, lang, {type, name})` - Extraire un élément
- `ctx.code.skeleton(content, lang)` - Obtenir les signatures uniquement

*Fichiers :*
- `ctx.files.read(path)` - Lire le contenu d'un fichier
- `ctx.files.exists(path)` - Vérifier si un fichier existe
- `ctx.files.glob(pattern)` - Trouver des fichiers par pattern

*Git :*
- `ctx.git.diff(ref?)` - Obtenir le diff git
- `ctx.git.log(limit?)` - Historique des commits
- `ctx.git.status()` - Statut du repo
- `ctx.git.branch()` - Info sur les branches
- `ctx.git.blame(file, line?)` - Git blame d'un fichier

*Recherche :*
- `ctx.search.grep(pattern, glob?)` - Rechercher un pattern dans les fichiers
- `ctx.search.symbols(query, glob?)` - Rechercher des symboles (fonctions, classes)
- `ctx.search.files(pattern)` - Rechercher des fichiers par pattern
- `ctx.search.references(symbol, glob?)` - Trouver les références d'un symbole

*Analyse :*
- `ctx.analyze.dependencies(file)` - Analyser les imports/exports
- `ctx.analyze.callGraph(fn, file, depth?)` - Construire le graphe d'appels
- `ctx.analyze.exports(file)` - Obtenir les exports d'un fichier
- `ctx.analyze.structure(dir?, depth?)` - Structure du répertoire avec analyse

*Utilitaires :*
- `ctx.utils.countTokens(text)` - Compter les tokens
- `ctx.utils.detectType(content)` - Détecter le type de contenu
- `ctx.utils.detectLanguage(path)` - Détecter le langage depuis le chemin

**Exemples :**

\`\`\`typescript
// Obtenir les squelettes de tous les fichiers TypeScript
const files = ctx.files.glob("src/**/*.ts").slice(0, 5);
return files.map(f => ({
  file: f,
  skeleton: ctx.code.skeleton(ctx.files.read(f), "typescript")
}));

// Compresser et analyser les logs
const logs = ctx.files.read("server.log");
return ctx.compress.logs(logs);

// Extraire une fonction spécifique
const content = ctx.files.read("src/api.ts");
return ctx.code.extract(content, "typescript", { type: "function", name: "handleRequest" });
\`\`\`

### Référence rapide

| Action | Utiliser |
|--------|----------|
| Lire du code pour exploration | `mcp__distill__smart_file_read filePath="file.ts"` |
| Obtenir une fonction/classe | `mcp__distill__smart_file_read filePath="file.ts" target={"type":"function","name":"myFunc"}` |
| Compresser les erreurs de build | `mcp__distill__auto_optimize content="..."` |
| Résumer les logs | `mcp__distill__summarize_logs logs="..."` |
| Opérations multi-étapes | `mcp__distill__code_execute code="return ctx.files.glob('src/**/*.ts')"` |
| Avant d'éditer | Utiliser l'outil natif `Read` |
