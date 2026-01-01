# PLAN: Parité Fonctionnelle Horus CLI ↔ Claude Code

> Document de suivi pour l'implémentation des fonctionnalités Claude Code dans Horus CLI.
> Dernière mise à jour: 2026-01-01

---

## Vue d'Ensemble

**Objectif**: Atteindre la parité fonctionnelle avec Claude Code d'Anthropic, en utilisant des modèles open source (Mistral/Devstral en priorité).

**Parité actuelle estimée**: ~80% (après Phase 4 Hooks System)

---

## Checklist des Fonctionnalités

### Phase 1: Système de Commandes ✅ COMPLÉTÉ

- [x] **Slash Commands System**
  - [x] Types et interfaces (`src/commands/slash/types.ts`)
  - [x] Parser frontmatter YAML (`src/commands/slash/parser.ts`)
  - [x] Loader project/user commands (`src/commands/slash/loader.ts`)
  - [x] Registry et exécution (`src/commands/slash/registry.ts`)
  - [x] Support `$ARGUMENTS` et `$ARG1`, `$ARG2`...
  - [x] Namespacing par répertoires (`git/pr.md` → `/git:pr`)
  - [x] Intégration UI avec autocomplete dynamique
  - [x] Icônes de scope (⚡ builtin, 📁 project, 👤 user)

- [x] **Built-in Commands** (11 commands)
  - [x] `/help [command]` - Aide contextuelle
  - [x] `/clear` - Effacer historique
  - [x] `/exit` - Quitter
  - [x] `/models [name]` - Lister/changer modèle
  - [x] `/config` - Afficher configuration
  - [x] `/compact` - Vider cache contexte
  - [x] `/init [--force]` - Générer HORUS.md
  - [x] `/commit [--push]` - Commit AI
  - [x] `/new-command <name> [--user]` - Créer custom command
  - [x] `/bug` - Signaler bug
  - [x] `/doctor` - Diagnostique

- [x] **Example Custom Commands**
  - [x] `/review` - Code review
  - [x] `/pr` - Create pull request
  - [x] `/test` - Run tests

---

### Phase 2: Tools Séparés ✅ COMPLÉTÉ

Claude Code utilise des tools séparés pour chaque opération. Horus combine certains dans un seul outil.

- [x] **Glob Tool** (séparé de search)
  - Fichier: `src/tools/glob.ts`
  - Pattern matching rapide avec glob syntax
  - Paramètres: `pattern`, `path`, `ignore`
  - Retourne: liste de fichiers triés par date modification

- [x] **Grep Tool** (séparé de search)
  - Fichier: `src/tools/grep.ts`
  - Recherche contenu avec ripgrep
  - Paramètres: `pattern`, `path`, `type`, `glob`, `-A/-B/-C`, `output_mode`
  - Modes output: `content`, `files_with_matches`, `count`

- [x] **LS Tool**
  - Fichier: `src/tools/ls.ts`
  - Listing répertoire avec ignore patterns
  - Paramètres: `path`, `ignore`, `all`, `long`, `recursive`, `depth`

- [x] **MultiEdit Tool**
  - Fichier: `src/tools/multi-edit.ts`
  - Éditions multiples atomiques dans un fichier
  - Paramètres: `file_path`, `edits[]` (array d'éditions)

- [x] **TodoRead Tool**
  - Ajouté à `src/tools/todo-tool.ts`
  - Lecture de l'état actuel des todos avec filtres

- [ ] **Refactoring Tool Registry** (reporté)
  - Convertir `src/horus/tools.ts` en pattern registry
  - Permettre l'enregistrement dynamique de tools
  - Support tools MCP et built-in unifiés

---

### Phase 3: Web Tools ✅ COMPLÉTÉ

- [x] **WebFetch Tool**
  - Fichier: `src/tools/web-fetch.ts`
  - Fetch URL + conversion HTML → Markdown
  - Cache 15 minutes auto-cleaning
  - Détection redirections cross-domain
  - Dépendances: `cheerio`, `turndown`

- [x] **WebSearch Tool**
  - Fichier: `src/tools/web-search.ts`
  - Recherche web via SearXNG (extensible pour Brave/Tavily)
  - Paramètres: `query`, `allowed_domains`, `blocked_domains`, `max_results`
  - Retourne: résultats formatés en markdown

---

### Phase 4: Hooks System ✅ COMPLÉTÉ

- [x] **Hooks Infrastructure**
  - Fichier: `src/hooks/hook-manager.ts`
  - Types: `src/hooks/types.ts`
  - Configuration: `.horus/hooks.json` et `~/.horus/hooks.json`

- [x] **Hook Types implémentés**
  - [x] `PreEdit` - Avant modification fichier (ex: prettier)
  - [x] `PostEdit` - Après modification (ex: lint check)
  - [x] `PreCommit` - Avant commit (intégré dans `/commit`)
  - [x] `PreSubmit` - Avant envoi message (intégré dans use-input-handler)

- [x] **Commande /hooks**
  - `/hooks list` - Lister tous les hooks
  - `/hooks add <name> <type> <command>` - Ajouter un hook
  - `/hooks remove <name>` - Supprimer un hook
  - `/hooks toggle <name>` - Activer/désactiver un hook

- [x] **Variables de contexte**
  - `$FILE` - Chemin du fichier (PreEdit/PostEdit)
  - `$CONTENT` - Contenu original (PreEdit)
  - `$NEW_CONTENT` - Nouveau contenu (PostEdit)
  - `$MESSAGE` - Message utilisateur (PreSubmit)
  - `$COMMIT_MSG` - Message de commit (PreCommit)
  - `$STAGED_FILES` - Fichiers stagés (PreCommit)

---

### Phase 5: Planning Mode 🔲 À FAIRE

- [ ] **Mode Planning**
  - Toggle avec `Shift+Tab` (actuellement auto-edit)
  - État read-only: peut lire/chercher mais pas modifier
  - Indicateur visuel dans status bar

- [ ] **ExitPlanMode Tool**
  - Fichier: `src/tools/exit-plan-mode.ts`
  - Transition plan → exécution après approbation

- [ ] **EnterPlanMode Tool**
  - Activation programmatique du mode planning
  - Pour tâches complexes nécessitant planification

- [ ] **AskUserQuestion Tool**
  - Questions structurées avec options
  - Multi-select support
  - Utilisé pour clarifications pendant planning

---

### Phase 6: Background Tasks 🔲 À FAIRE

- [ ] **Background Shell Execution**
  - Paramètre `run_in_background` sur bash tool
  - Stockage des shells actifs

- [ ] **BashOutput Tool**
  - Récupérer output d'un shell background
  - Paramètres: `shell_id`, `block`, `timeout`

- [ ] **KillShell Tool**
  - Terminer un shell background
  - Paramètre: `shell_id`

- [ ] **Task Tool (Subagents)**
  - Exposer `SubagentManager` comme tool
  - Types d'agents: `general-purpose`, `Explore`, `Plan`
  - Exécution en background avec `run_in_background`

---

### Phase 7: Git Workflows 🔲 À FAIRE

- [ ] **PR Creation complète**
  - Améliorer `/pr` pour utiliser `gh pr create`
  - Format PR body standardisé
  - Support base branch configurable

- [ ] **Code Review Workflow**
  - `/review-pr <number>` - Review une PR existante
  - Fetch comments, diff, analyser

- [ ] **Git Safety Protocol**
  - Validation avant push --force
  - Vérification amend conditions
  - Warnings pour opérations destructives

---

### Phase 8: Features Avancées 🔲 À FAIRE (Priorité Basse)

- [ ] **Extended Thinking**
  - Détecter mots-clés: "think", "think hard", "think harder", "ultrathink"
  - Augmenter budget de raisonnement selon niveau

- [ ] **Checkpointing**
  - Shadow git repository pour rewind
  - Commande `/checkpoint` et `/rewind`

- [ ] **Sandboxing**
  - Isolation network/filesystem optionnelle
  - Configuration dans settings

- [ ] **Skills System**
  - Prompts réutilisables avec paramètres
  - Différent des slash commands (plus orienté agent)

- [ ] **Output Styles**
  - Personnalisation format sortie
  - Styles: concise, verbose, markdown, json

- [ ] **Jupyter Notebooks**
  - `NotebookRead` - Lire notebooks
  - `NotebookEdit` - Éditer cellules

- [ ] **PDF/Image Support**
  - Lecture PDF dans Read tool
  - Support images (multimodal)

---

## Architecture Cible

```
src/
├── commands/
│   └── slash/           ✅ FAIT
│       ├── types.ts
│       ├── parser.ts
│       ├── loader.ts
│       ├── registry.ts
│       ├── builtin/
│       │   └── index.ts
│       └── index.ts
│
├── tools/               🔲 À REFACTORER
│   ├── registry.ts      # NEW: Tool registry pattern
│   ├── bash.ts
│   ├── glob.ts          # NEW: Séparé
│   ├── grep.ts          # NEW: Séparé
│   ├── ls.ts            # NEW
│   ├── read.ts          # Renommé de text-editor
│   ├── edit.ts
│   ├── multi-edit.ts    # NEW
│   ├── write.ts
│   ├── web-fetch.ts     # NEW
│   ├── web-search.ts    # NEW
│   ├── task.ts          # NEW: Subagents exposés
│   ├── exit-plan-mode.ts # NEW
│   ├── ask-user.ts      # NEW
│   ├── todo/
│   │   ├── todo-write.ts
│   │   └── todo-read.ts # NEW
│   └── background/      # NEW
│       ├── bash-output.ts
│       └── kill-shell.ts
│
├── hooks/               🔲 À CRÉER
│   ├── hook-manager.ts
│   ├── types.ts
│   └── builtin/
│       ├── prettier.ts
│       └── lint.ts
│
├── agent/
│   ├── phases/
│   │   ├── plan-phase.ts  # NEW: Planning mode
│   │   ├── gather-phase.ts
│   │   └── verify-phase.ts
│   └── core/
│       └── system-prompt/  # À modulariser
│           ├── base.ts
│           ├── tools.ts
│           └── behaviors.ts
│
└── ...
```

---

## Code à Nettoyer

### Doublons à Supprimer
- [ ] `src/tools/search.ts` → Migrer vers search-v2, supprimer
- [ ] `src/ui/components/chat-interface.tsx` → Garder modern-* uniquement
- [ ] `src/ui/components/chat-input.tsx` → Doublon
- [ ] `src/ui/components/chat-history.tsx` → Doublon
- [ ] `src/ui/components/loading-spinner.tsx` → Doublon

### Refactoring
- [ ] `src/horus/tools.ts` - Convertir en registry pattern
- [ ] `src/agent/core/system-prompt.ts` - Modulariser (155 lignes)
- [ ] `src/agent/horus-agent.ts` - Extraire plus de logique (700 lignes)

---

## Prochaines Étapes Recommandées

### Session Suivante: Phase 2 (Tools Séparés)
1. Créer `src/tools/glob.ts`
2. Créer `src/tools/grep.ts`
3. Créer `src/tools/ls.ts`
4. Mettre à jour `src/horus/tools.ts` pour utiliser les nouveaux tools
5. Tests manuels

### Session +2: Phase 3 (Web Tools)
1. Implémenter `WebFetch`
2. Implémenter `WebSearch`
3. Intégrer dans le système de tools

### Session +3: Phase 4 (Hooks)
1. Créer l'infrastructure hooks
2. Implémenter hooks de base
3. Commande `/hooks`

---

## Notes de Développement

### Dépendances à Ajouter
```bash
# Pour WebFetch
pnpm add cheerio

# Pour WebSearch (optionnel, selon API choisie)
pnpm add @anthropic-ai/sdk  # Si utilisation API Anthropic pour search
```

### Variables d'Environnement
```bash
# Existantes
HORUS_API_KEY=
HORUS_BASE_URL=
HORUS_MODEL=
MORPH_API_KEY=
HORUS_CONTEXT_DEBUG=true

# À ajouter
HORUS_WEBSEARCH_API_KEY=  # Pour WebSearch
HORUS_PLANNING_MODE=false  # Default planning mode
```

### Commandes de Dev
```bash
# Dev mode
bun run dev

# Build
bun run build

# Type check
bun run typecheck

# Run directement
bun run src/index.ts
```

---

## Ressources

- [Claude Code GitHub](https://github.com/anthropics/claude-code)
- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- [Tools Reference](https://www.vtrivedy.com/posts/claudecode-tools-reference)
- [System Prompt Gist](https://gist.github.com/wong2/e0f34aac66caf890a332f7b6f9e2ba8f)

---

*Ce document est le référentiel principal pour le développement de la parité Claude Code.*
