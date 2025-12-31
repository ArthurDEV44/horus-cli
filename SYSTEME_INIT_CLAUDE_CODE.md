# Système /init - Spécification pour Horus CLI

**État** : Phase 1 terminée (infrastructure)
**Dernière mise à jour** : 2025-12-31
**Référence** : Basé sur le reverse-engineering de Claude Code /init

---

## Prompt système /init (fidèle à Claude Code)

Le prompt réel de Claude Code /init est concis :

```
Please analyze this codebase and create a HORUS.md file, which will be given
to future instances of Horus to operate in this repository.

Include:
1. Build/lint/test commands - especially for running a single test
2. Code style guidelines (imports, formatting, types, naming, error handling)

Guidelines:
- Keep it ~20 lines, concise and actionable
- Skip obvious/generic development practices
- Incorporate existing rules from .cursor/ or .github/ if present
- If HORUS.md exists, update it based on current codebase state
```

---

## Fichiers analysés par /init

Claude Code utilise `BatchTool` pour scanner en parallèle :

```
package*.json          # deps, scripts, metadata
*.md                   # README, docs existantes
tsconfig.json          # config TypeScript
.eslintrc*             # règles linting
.cursor/rules/**       # règles Cursor si présent
.github/copilot-instructions.md  # instructions Copilot si présent
```

---

## Exemple de HORUS.md généré (~30 lignes)

Voici ce que `/init` devrait générer pour Horus CLI :

```markdown
# HORUS.md

## Build & Dev Commands

pnpm install           # Install deps
bun run dev            # Dev mode with hot reload
bun run build          # Build to dist/
bun test               # Run all tests
bun test tests/cache   # Run single test file

## Code Style

- ESM imports with .js extension: `import { X } from "./module.js"`
- Files: kebab-case (context-orchestrator.ts)
- Classes: PascalCase (ContextOrchestrator)
- Use async/await, not promise chains
- Tools return `{ success, output?, error? }`

## Architecture

Agent-based CLI: src/agent/ (core), src/tools/ (6 tools), src/context/ (orchestration)
UI: React/Ink in src/ui/

## Key Patterns

- Singletons: getSettingsManager(), getContextCache()
- Feature flags: HORUS_CONTEXT_MODE=off|mvp|full
- Tool interface: name, description, execute(args) → ToolResult
```

---

## Différences clés avec l'approche précédente

| Aspect | Ancienne approche (over-engineered) | Nouvelle approche (fidèle) |
|--------|-------------------------------------|---------------------------|
| **Taille HORUS.md** | ~1500 lignes | ~20-50 lignes |
| **Contenu** | Documentation exhaustive | Commandes + conventions essentielles |
| **Philosophie** | Tout documenter | Progressive Disclosure |
| **Maintenance** | Difficile (trop long) | Facile (concis) |

---

## Principe "Progressive Disclosure"

> "Don't tell Claude all the information you could possibly want it to know.
> Rather, tell it **how to find** important information so that it can find
> and use it, but only when it needs to."
> — Anthropic Best Practices

**Exemple** : Au lieu de documenter toute l'architecture dans HORUS.md, indiquer :
```markdown
## Where to find info
- Architecture: see src/agent/horus-agent.ts (main orchestrator)
- Tools: see src/tools/*.ts
- Tests: see tests/*.spec.ts
```

---

## Implémentation simplifiée pour Horus CLI

### Ce qu'il faut garder (Phase 1 terminée)

- `src/init/types.ts` - Types de base
- `src/init/scanner.ts` - Scan package.json, tsconfig
- `src/commands/init.ts` - Commande CLI

### Ce qu'il faut simplifier (Phases 2-8)

1. **Scanner** : Seulement package.json + tsconfig + git metadata
2. **Generator** : Template simple de ~30 lignes, pas 10 sections
3. **Updater** : Simple remplacement, pas de fusion complexe
4. **Supprimer** :
   - SnippetBuilder (over-engineering)
   - Diagrammes ASCII auto-générés
   - Multi-templates
   - Export HTML/PDF

### Template simplifié

```typescript
// src/init/templates/simple-template.ts
export const HORUS_TEMPLATE = `# HORUS.md

## Build & Dev Commands

{INSTALL_CMD}
{DEV_CMD}
{BUILD_CMD}
{TEST_CMD}

## Code Style

{CODE_STYLE}

## Architecture

{ARCHITECTURE_SUMMARY}

## Key Patterns

{KEY_PATTERNS}
`;
```

---

## Comportement attendu de `horus init`

```bash
$ horus init
🔍 Scanning codebase...
📝 Generating HORUS.md...
✅ Created HORUS.md (32 lines)

$ horus init  # Si HORUS.md existe
🔍 Scanning codebase...
📝 Updating HORUS.md...
✅ Updated HORUS.md (added 2 new dependencies)
```

---

## Références

- [Build your own /init command](https://kau.sh/blog/build-ai-init-command/)
- [Reverse engineering Claude Code](https://kirshatrov.com/posts/claude-code-internals)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Using CLAUDE.md files](https://claude.com/blog/using-claude-md-files)

---

## Changelog

### 2025-12-31
- Réécriture complète basée sur recherches web
- Réduction du HORUS.md cible de ~1500 à ~30 lignes
- Suppression de l'over-engineering (diagrammes, multi-templates, etc.)
- Alignement avec les best practices Anthropic

### 2025-11-24
- Création initiale (version over-engineered)
- Phase 1 infrastructure terminée
