# Architecture des Subagents - Phase 3

> Documentation du système de subagents pour la parallélisation avec isolation contextuelle

**Date**: 2025-01-23
**Version**: 1.0
**Phase**: 3 (SubagentManager)

---

## Vue d'ensemble

Le système de subagents permet à Horus CLI de paralléliser des tâches indépendantes en maintenant des contextes isolés. Chaque subagent est une instance isolée de `HorusAgent` avec son propre contexte, ses propres outils, et un budget tokens réduit.

### Principes de design (inspirés de Claude Code)

1. **Isolation contextuelle**: Chaque subagent a son propre historique, aucune communication entre subagents
2. **Limite de concurrence**: Maximum 3 subagents en parallèle pour gérer la VRAM
3. **Pas de nesting**: Les subagents ne peuvent pas spawner d'autres subagents (prévention récursion infinie)
4. **Résultats concis**: Chaque subagent retourne un résumé concis (<500 tokens) à l'orchestrateur
5. **Timeout protection**: Chaque subagent a un timeout (60s par défaut)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  ContextOrchestrator                         │
│  - detectParallelizableTasks()                               │
│  - executeWithSubagents()                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   SubagentManager    │
          │  - spawn()           │
          │  - spawnParallel()   │
          └──────────┬───────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │Subagent│  │Subagent│  │Subagent│
   │   #1   │  │   #2   │  │   #3   │
   └────────┘  └────────┘  └────────┘
   (HorusAgent) (HorusAgent) (HorusAgent)
   contexte     contexte     contexte
   isolé        isolé        isolé
```

---

## Composants

### 1. SubagentManager

**Fichier**: `src/context/subagent-manager.ts`

#### Configuration

```typescript
interface SubagentManagerConfig {
  maxConcurrent?: number;     // Défaut: 3
  timeout?: number;           // Défaut: 60000ms (1 min)
  debug?: boolean;
  apiKey: string;
  baseURL?: string;
  model?: string;
}
```

#### Méthodes principales

**`spawn(task: SubtaskRequest): Promise<SubagentResult>`**

Lance un subagent unique avec contexte isolé.

- Crée un nouveau `HorusAgent` avec:
  - Historique vide (pas de mémoire partagée)
  - Tools whitelistés (sécurité)
  - maxToolRounds réduit (50 vs 400)
  - Context window réduit (8K vs 128K)
- Timeout après 60s (configurable)
- Retourne résumé concis + métadonnées

**`spawnParallel(tasks: SubtaskRequest[]): Promise<SubagentResult[]>`**

Lance plusieurs subagents en parallèle (batches si >3).

- Divise en batches de 3 max
- Exécute chaque batch en parallèle via `Promise.all()`
- Agrège tous les résultats
- Gestion automatique de la concurrence

#### Exemple d'usage

```typescript
import { SubagentManager } from '../context/subagent-manager.js';

const manager = new SubagentManager({
  apiKey: process.env.HORUS_API_KEY || '',
  maxConcurrent: 3,
  debug: true,
});

// Tâche unique
const result = await manager.spawn({
  files: ['src/file1.ts', 'src/file2.ts'],
  instruction: 'Add JSDoc comments to all functions',
  tools: ['view_file', 'str_replace_editor'],
});

console.log(result.summary);
console.log(result.changes); // ['src/file1.ts', 'src/file2.ts']

// Tâches parallèles
const tasks = [
  { files: ['src/a.ts', 'src/b.ts'], instruction: '...', tools: [...] },
  { files: ['src/c.ts', 'src/d.ts'], instruction: '...', tools: [...] },
  { files: ['src/e.ts', 'src/f.ts'], instruction: '...', tools: [...] },
];

const results = await manager.spawnParallel(tasks);
console.log(`Completed: ${results.filter(r => r.success).length}/3`);
```

---

### 2. Détection automatique (ContextOrchestrator)

**Fichier**: `src/context/orchestrator.ts`

#### Pattern matching

La fonction `detectParallelizableTask()` détecte automatiquement les requêtes parallélisables:

**Patterns supportés**:
- `"all files"` (English)
- `"tous les fichiers"` (French)
- `"all *.ts"` (wildcard)
- `"every file"`
- `"all X"` (regex: `\ball\s+\w+`) → "all functions", "all classes", etc.
- `"every X"` (regex: `\bevery\s+\w+`)

**Conditions**:
- Au moins 3 fichiers (sinon pas de parallélisation)
- Pattern correspondant détecté

#### Batching automatique

Divise les fichiers en **3 batches égaux**:

```typescript
const batchSize = Math.ceil(files.length / 3);

// Exemples:
// 3 files  → [1, 1, 1]
// 9 files  → [3, 3, 3]
// 10 files → [4, 4, 2]
```

#### Intégration dans `gather()`

```typescript
async gather(request: ContextRequest): Promise<ContextBundle> {
  // Phase 3: Check if parallelizable
  if (this.subagentManager) {
    const parallelTasks = await this.detectParallelizableTasks(request);
    if (parallelTasks && parallelTasks.length > 0) {
      return await this.executeWithSubagents(parallelTasks, startTime);
    }
  }

  // Fallback: regular agentic search
  // ...
}
```

---

### 3. Types et interfaces

**Fichier**: `src/types/context.ts`

```typescript
// Ajout dans ContextMetadata
interface ContextMetadata {
  // ... existing fields ...

  /** Results from subagent execution (Phase 3) */
  subagentResults?: {
    total: number;
    successful: number;
    failed: number;
    filesModified: number;
  };
}
```

---

## Activation

### Feature flag

Le système de subagents est activé via la variable d'environnement:

```bash
export HORUS_USE_SUBAGENTS=true
```

Si désactivé, le système fonctionne normalement en mode "agentic search" classique.

### Prevention du nesting

Pour éviter qu'un subagent spawne un autre subagent (récursion infinie):

```bash
# Set automatiquement par SubagentManager.spawn()
export HORUS_SUBAGENT_MODE=true
```

Quand `HORUS_SUBAGENT_MODE=true`, le `ContextOrchestrator` ne créera **pas** de `SubagentManager`.

---

## Cas d'usage

### Exemple 1: Refactor multi-fichiers

**User prompt**:
```
Refactor all files in src/tools/ to use async/await
```

**Détection**:
- Pattern: "all files" ✅
- Fichiers trouvés: 9 files in `src/tools/`
- Batches: 3 (3 files each)

**Exécution**:
```
Subagent #1: src/tools/{text-editor, bash, search}.ts
Subagent #2: src/tools/{todo, confirmation, morph}.ts
Subagent #3: src/tools/{search-v2}.ts

Duration: ~15-25s (parallel)
vs ~45-75s (sequential)
```

### Exemple 2: Add JSDoc comments

**User prompt**:
```
Add JSDoc comments to all functions in the codebase
```

**Détection**:
- Pattern: "all functions" ✅ (via regex `\ball\s+\w+`)
- Fichiers trouvés: 42 files
- Batches: 3 (14 files each)

**Exécution**:
```
Batch 1: Subagents #1-3 (14 files each)
Batch 2: Subagents #1-3 (14 files each)

Total duration: ~60-90s (2 batches sequential)
```

### Exemple 3: Cas non parallélisable

**User prompt**:
```
Explain how the TextEditorTool works
```

**Détection**:
- Pattern: ❌ (pas de "all" ou "every")
- Fallback: agentic search classique
- Pas de subagents

---

## Limites et contraintes

### 1. VRAM

**Limite**: 3 subagents concurrents max

**Raison**:
- Chaque HorusAgent = 1 instance LLM active
- Modèles Ollama locaux (7B-24B params)
- 3 × 8GB VRAM ≈ 24GB total
- Au-delà → risque OOM

**Solution**: Batching automatique si >3 tâches

### 2. Timeout

**Défaut**: 60s par subagent

**Raison**:
- Éviter les subagents "zombies"
- Limiter les boucles tool loop infinies
- Fallback: retourner résumé partiel

**Configuration**:
```typescript
new SubagentManager({ timeout: 120000 }); // 2 min
```

### 3. Context window

**Subagent**: 8K tokens (vs 128K pour agent principal)

**Raison**:
- Tâches subagents = scope réduit (2-5 fichiers)
- Faster inference (8K → ~3x plus rapide)
- Moins de VRAM par subagent

### 4. Tool whitelist

**Default**: `['view_file', 'str_replace_editor', 'replace_lines', 'create_file']`

**Raison**:
- Sécurité (pas de bash, pas de confirmation)
- Focus sur édition fichiers
- Prévisibilité

**Custom**:
```typescript
const task: SubtaskRequest = {
  files: [...],
  instruction: '...',
  tools: ['view_file', 'bash'], // Custom whitelist
};
```

---

## Métriques et telemetry

### Telemetry intégrée

Chaque subagent enregistre:
- `operation: 'view'`
- `filesScanned`, `filesRead`
- `duration` (ms)
- `tokensEstimated`
- `strategy: 'subagent'`

### ContextBundle metadata

```typescript
bundle.metadata.subagentResults = {
  total: 3,
  successful: 3,
  failed: 0,
  filesModified: 9,
};
```

### Debug mode

```bash
export HORUS_CONTEXT_DEBUG=true
export HORUS_USE_SUBAGENTS=true

horus --prompt "Refactor all files"
```

**Logs**:
```
[SubagentManager] Initialized (maxConcurrent: 3)
[SubagentManager] Spawning subagent for 3 files
[SubagentManager] Instruction: Refactor all files to use async/await...
[SubagentManager] Subagent completed in 18452ms
[SubagentManager] Files modified: 3
[ContextOrchestrator] Subagent execution completed:
  - subagents: 3
  - successful: 3
  - filesModified: 9
  - tokens: 15230
  - duration: 22184ms
```

---

## Tests

### tests/subagent-manager.spec.ts

**14 tests** couvrant:

1. **Pattern detection**:
   - `"all files"` (English)
   - `"tous les fichiers"` (French)
   - `"all *.ts"`
   - `"every file"`
   - `"all functions"` (regex)

2. **Batching**:
   - 3 fichiers → 3 batches (1 each)
   - 9 fichiers → 3 batches (3 each)
   - 10 fichiers → 3 batches (4, 4, 2)
   - 100 fichiers → 3 batches (34, 33, 33)

3. **Edge cases**:
   - <3 fichiers → null (pas parallélisable)
   - Pattern non correspondant → null
   - Instruction preservée dans chaque subtask
   - Tools whitelist par défaut

**Résultat**: ✅ 69/69 tests passent (14 Phase 3 + 55 précédents)

---

## Prochaines étapes

### Phase 4: Verification

- Lint check après modifications subagents
- Test runner optionnel
- Feedback loop si erreurs

### Phase 5: Optimisation

- Sélection modèle adaptative par subagent
- Detection VRAM → ajuster maxConcurrent dynamiquement
- Metrics comparatives (parallel vs sequential)

---

## Références

- **ROADMAP.md**: Plan détaillé Phase 3
- **TODO.md**: État d'avancement
- **src/context/subagent-manager.ts**: Code source
- **tests/subagent-manager.spec.ts**: Tests unitaires
- [Claude Code Subagent Architecture](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)

---

**Auteur**: Claude Code + équipe Horus CLI
**Licence**: Même licence que Horus CLI
