# Horus CLI — Roadmap vers un système de contexte agentique local

> **Vision** : Implémenter un orchestrateur de contexte inspiré de Claude Code pour Horus CLI, optimisé pour les modèles locaux Ollama, avec une approche MVP-first évolutive vers la production.

## Table des matières

1. [Résumé exécutif](#résumé-exécutif)
2. [Insights de la recherche](#insights-de-la-recherche)
3. [Architecture cible MVP](#architecture-cible-mvp)
4. [Roadmap d'implémentation](#roadmap-dimplémentation)
5. [Stratégie modèles Mistral/Ollama](#stratégie-modèles-mistralollama)
6. [Métriques de succès](#métriques-de-succès)

---

## Résumé exécutif

### Objectif principal
Doter Horus CLI d'un système de contexte agentique suivant la boucle **gather → act → verify**, sans dépendances externes lourdes (pas de bases vectorielles, pas d'indexation persistante), optimisé pour les contraintes des modèles locaux Ollama.

### Principes directeurs issus de la recherche

1. **Simplicité d'abord** : Claude Code privilégie la "recherche agentique" (grep/bash/view) plutôt que la recherche sémantique pour la transparence et la précision
2. **Isolation contextuelle** : Les subagents ont leurs propres fenêtres de contexte et ne retournent que les informations pertinentes à l'orchestrateur
3. **Compaction automatique** : Résumer l'historique quand on approche la limite du contexte au lieu de crasher
4. **Instrumentation dès le départ** : Mesurer tokens, temps, taux de rappel avant d'optimiser
5. **Context window = levier de performance #1** : Pour Ollama, réduire le contexte de 32K à 4K peut multiplier la vitesse par 3-5x

### Différenciateurs Horus CLI vs Claude Code

| Aspect | Claude Code (Anthropic) | Horus CLI (Local) |
|--------|-------------------------|-------------------|
| **Modèle** | Sonnet 4 (1M tokens, cloud) | Mistral/Mixtral (8-128K, local) |
| **Latence** | ~1-2s (réseau + GPU cloud) | Variable (CPU/GPU local) |
| **Coût** | Pay-per-token | Gratuit (ressources locales) |
| **Privacy** | Cloud (avec garanties Anthropic) | 100% local |
| **Optimisation** | Optimize pour profondeur | Optimize pour vitesse + mémoire |

**Stratégie** : Adapter les patterns de Claude Code aux contraintes des modèles locaux en privilégiant :
- Contextes plus courts (4-16K par défaut vs 32-128K)
- Compression structurelle sans LLM (pas de résumés coûteux)
- Cache agressif pour éviter re-lectures
- Subagents limités (max 3 parallèles) pour maîtriser VRAM

---

## Insights de la recherche

### 1. Claude Code : Architecture de contexte

**Découvertes clés** :

#### A. Commandes de gestion contextuelle
- `/clear` : Efface l'historique (utiliser fréquemment entre features)
- `/compact [instructions]` : Résume la conversation en préservant les faits clés
- `/resume` : Reprend une session sauvegardée
- **CLAUDE.md** : Instructions projet auto-chargées (architecture, commandes, conventions)

#### B. Subagents pour isolation
- Chaque subagent = contexte isolé + outils restreints
- Ne peuvent pas spawner d'autres subagents (évite la récursion infinie)
- Retournent seulement un "resulting context" concis à l'orchestrateur
- Permettent parallélisation (ex: 3 subagents cherchent dans différentes parties du repo)

#### C. Stratégies de recherche
1. **Agentic search** (recommandé par défaut) : grep/bash/view incrémentaux
2. **Semantic search** (optionnel) : Embeddings/vectoriel quand vitesse critique
3. **Hybrid** : Combine les deux pour meilleurs rappels

**Insight critique** : "Semantic search trades accuracy and transparency for speed. Start with agentic search."

### 2. Contextual Retrieval d'Anthropic

**Technique phare** : Ajouter du contexte explicatif à chaque chunk avant embedding/indexing.

**Performances mesurées** :
- Contextual Embeddings seul : **-35% d'échecs** (5.7% → 3.7%)
- + Contextual BM25 : **-49% d'échecs** (5.7% → 2.9%)
- + Reranking : **-67% d'échecs** (5.7% → 1.9%)

**Paramètres typiques** :
- Chunks : 800 tokens
- Contexte ajouté : 50-100 tokens
- Coût one-time : $1.02/million tokens (avec prompt caching)
- Top-N initial : 150 chunks → reranking → top 20 final

**Application Horus** :
- ⚠️ Trop coûteux pour local (nécessite appels LLM pour chaque chunk)
- ✅ On garde le principe mais avec compression **structurelle** (AST, exports, signatures)
- ✅ BM25 maison faisable (tf-idf basique)
- ❌ Pas d'embeddings (pas de modèle d'embedding local fiable sans VRAM)

### 3. Boucle Gather-Act-Verify

**Documentation Anthropic** :

```
1. GATHER CONTEXT
   - Agentic search : grep/tail/head incrémentaux
   - Structure de dossiers = context engineering
   - Éviter le "data bloat" (ne pas tout charger)

2. TAKE ACTION
   - Tools (prominently featured in context)
   - Bash & code generation (precise, composable)
   - MCPs pour intégrations standardisées

3. VERIFY WORK
   - Rules-based : linting, type checking
   - Visual feedback : screenshots (pas applicable CLI)
   - LLM-as-judge : fuzzy eval (lent, moins robuste)
```

**Application Horus** :
- **Gather** : Améliorer `SearchTool` + caching
- **Act** : Tools existants OK (`TextEditorTool`, `BashTool`, MCPs)
- **Verify** : Ajouter lint/test hooks post-action

### 4. Optimisation Ollama Context Window

**Découvertes critiques** :

> "The single biggest lever for speed is context length. Shortening from tens of thousands to a few thousand can saturate your GPU and produce answers many times faster."

**Trade-offs VRAM** :
- Chaque +4K tokens = +1GB VRAM
- Scaling quadratique de l'attention = contexte = driver #1 du coût compute

**Configuration Ollama** :
```bash
# CLI runtime
ollama run mistral --param num_ctx 4096

# Modelfile persistent
PARAMETER num_ctx 8192
```

**Recommandations Horus** :
1. Détecter VRAM disponible au startup
2. Adapter `num_ctx` dynamiquement :
   - <8GB VRAM : 4K contexte (mistral 7B)
   - 8-16GB : 8K (mistral-small 22B)
   - 16-32GB : 32K (mixtral 8x7B)
   - 32GB+ : 128K (devstral)
3. Logging : tracker tokens réels vs budget contexte

---

## Architecture cible MVP

### Principes de design

1. **Non-invasif** : Le système doit être un **décorateur** autour de `HorusAgent` existant, pas un remplacement
2. **Feature flag** : `HORUS_CONTEXT_MODE=off|mvp|full` pour rollout progressif
3. **Rétrocompatible** : Mode "off" = comportement actuel identique
4. **Observable** : Télémétrie obligatoire dès la Phase 0

### Architecture simplifiée

```
                           ┌─────────────────────────┐
                           │   User Prompt           │
                           └───────────┬─────────────┘
                                       │
                           ┌───────────▼─────────────┐
                           │  ContextOrchestrator    │◄── NOUVEAU (Phase 1)
                           │  - gather()             │
                           │  - compact()            │
                           │  - isolate()            │
                           └───┬────────────────┬────┘
                               │                │
                  ┌────────────▼──┐      ┌─────▼──────────────┐
                  │ ContextCache  │      │  SubagentManager   │
                  │ (LRU, TTL)    │      │  (max 3 parallel)  │
                  └────────────┬──┘      └─────┬──────────────┘
                               │                │
                  ┌────────────▼────────────────▼──────────────┐
                  │         HorusAgent (existant)              │
                  │  - processUserMessage()                    │
                  │  - executeTools()                          │
                  └────────────┬───────────────────────────────┘
                               │
                  ┌────────────▼───────────────────────────────┐
                  │         HorusClient                        │
                  │  - chat() avec num_ctx adaptatif           │
                  └────────────┬───────────────────────────────┘
                               │
                  ┌────────────▼───────────────────────────────┐
                  │  VerificationPipeline                      │◄── NOUVEAU (Phase 4)
                  │  - lint check (fast)                       │
                  │  - test runner (opt-in)                    │
                  └────────────────────────────────────────────┘
```

### Composants détaillés

#### 1. ContextOrchestrator (Phase 1)

**Responsabilités** :
- Planifier quelles sources lire avant chaque appel LLM
- Gérer le budget tokens (% réservé contexte vs instructions)
- Déclencher la compaction si approche limite
- Router vers subagents si tâche parallélisable

**Interface TypeScript** :
```typescript
// src/context/orchestrator.ts
interface ContextRequest {
  intent: IntentType;           // 'explain' | 'refactor' | 'debug' | 'implement'
  query: string;                // User prompt original
  currentContext: ChatEntry[];  // Historique actuel
  budget: {
    maxTokens: number;          // Depuis model-configs.ts
    reservedForContext: number; // % du budget (ex: 30%)
  };
}

interface ContextBundle {
  sources: ContextSource[];     // Fichiers/snippets sélectionnés
  metadata: {
    filesScanned: number;
    filesRead: number;
    tokensUsed: number;
    strategy: string;           // 'agentic-search' | 'cached' | 'subagent'
    duration: number;
  };
}

class ContextOrchestrator {
  async gather(request: ContextRequest): Promise<ContextBundle> {
    // 1. Check cache
    const cached = this.cache.get(request.query);
    if (cached && !this.isStale(cached)) return cached;

    // 2. Plan strategy
    const strategy = this.planStrategy(request.intent);

    // 3. Execute (agentic search, subagents, etc.)
    const sources = await strategy.execute(request);

    // 4. Build bundle
    return this.buildBundle(sources);
  }

  async compact(history: ChatEntry[]): Promise<ChatEntry[]> {
    // Résumé structurel (pas d'appel LLM)
    return this.structuralSummary(history);
  }

  async isolate(task: SubtaskRequest): Promise<SubagentResult> {
    // Spawn subagent avec contexte minimal
    return this.subagentManager.spawn(task);
  }
}
```

#### 2. ContextCache (Phase 1)

**Features** :
- LRU avec capacité max (ex: 100 entrées)
- TTL par défaut : 5 minutes (invalidation sur modif fichier)
- Clé = hash(filePath + lineRange)
- Tracking : hit rate, tokens économisés

**Invalidation** :
```typescript
// src/context/cache.ts
class ContextCache {
  private watcher: FSWatcher;

  constructor() {
    // Watch file changes
    this.watcher = chokidar.watch('.', {
      ignored: ['node_modules', '.git', 'dist'],
      ignoreInitial: true,
    });

    this.watcher.on('change', (path) => {
      this.invalidate(path);
      this.invalidateImporters(path); // Cascade invalidation
    });
  }

  invalidateImporters(path: string) {
    // Invalider les fichiers qui importent ce fichier
    const importers = this.dependencyGraph.getImporters(path);
    importers.forEach(imp => this.invalidate(imp));
  }
}
```

#### 3. SubagentManager (Phase 2)

**Contraintes locales** :
- Max 3 subagents parallèles (limite VRAM)
- Chaque subagent = contexte isolé (4-8K tokens max)
- Pas de nesting (subagents ne peuvent pas spawner de subagents)

**Use cases** :
```typescript
// Exemple : Refactor multi-fichiers
const task = {
  intent: 'refactor',
  scope: ['src/tools/*.ts'],
  instruction: 'Add error handling to all tools',
};

// Orchestrator split en 3 subagents
const results = await Promise.all([
  subagent1.run({ files: ['text-editor.ts', 'bash.ts'] }),
  subagent2.run({ files: ['search.ts', 'todo-tool.ts'] }),
  subagent3.run({ files: ['confirmation-tool.ts', 'morph-editor.ts'] }),
]);

// Merge results (lightweight)
return results.map(r => r.summary).join('\n');
```

#### 4. SearchToolV2 (Phase 2)

**Améliorations** :
```typescript
// src/tools/search-v2.ts
interface SearchOptions {
  patterns: string[];           // Multi-pattern support
  exclude: string[];
  maxResults: number;           // Default: 50 (vs 100 actuel)
  scoreBy: 'modified' | 'imports' | 'fuzzy';
  returnFormat: 'paths' | 'snippets'; // Snippets = premiers 20 lignes
}

class SearchToolV2 {
  async search(options: SearchOptions): Promise<SearchResult[]> {
    // 1. Glob files
    const files = await this.globMultiPattern(options.patterns);

    // 2. Filter excluded
    const filtered = this.applyExclusions(files, options.exclude);

    // 3. Score files
    const scored = await this.scoreFiles(filtered, options.scoreBy);

    // 4. Limit & format
    return scored
      .slice(0, options.maxResults)
      .map(f => this.format(f, options.returnFormat));
  }

  private scoreFiles(files: string[], strategy: string): ScoredFile[] {
    switch (strategy) {
      case 'modified':
        return this.scoreByRecency(files);
      case 'imports':
        return this.scoreByImportGraph(files); // AST parsing
      case 'fuzzy':
        return this.scoreByLevenshtein(files);
      default:
        return files.map(f => ({ path: f, score: 1 }));
    }
  }
}
```

#### 5. VerificationPipeline (Phase 4)

**Approche adaptative** :
```typescript
// src/context/verification.ts
interface VerificationResult {
  passed: boolean;
  checks: {
    lint?: { passed: boolean; issues: string[] };
    tests?: { passed: boolean; output: string };
    types?: { passed: boolean; errors: string[] };
  };
  duration: number;
}

class VerificationPipeline {
  async verify(
    action: ToolResult,
    mode: 'fast' | 'thorough'
  ): Promise<VerificationResult> {
    const checks: VerificationResult['checks'] = {};

    // Always: lint check (fast)
    if (action.filePath?.endsWith('.ts')) {
      checks.lint = await this.runLint(action.filePath, { timeout: 2000 });
    }

    // Thorough only: tests
    if (mode === 'thorough' && this.hasTests(action.filePath)) {
      checks.tests = await this.runTests(
        this.findRelatedTests(action.filePath),
        { timeout: 10000 }
      );
    }

    return {
      passed: Object.values(checks).every(c => c.passed),
      checks,
      duration: Date.now() - startTime,
    };
  }
}
```

---

## Roadmap d'implémentation

### Vue d'ensemble

| Phase | Durée | Objectif | Risque |
|-------|-------|----------|--------|
| **Phase 0** | 1 semaine | Instrumentation & baseline | 🟢 LOW |
| **Phase 1** | 2 semaines | ContextOrchestrator MVP | 🟡 MEDIUM |
| **Phase 2** | 2 semaines | SearchToolV2 + scoring | 🟡 MEDIUM |
| **Phase 3** | 1 semaine | SubagentManager | 🟠 MEDIUM-HIGH |
| **Phase 4** | 2 semaines | Verification + UX CLI | 🟢 LOW |
| **Phase 5** | 1 semaine | Tuning modèles + benchmarks | 🟢 LOW |

**Total : 9 semaines** (budget buffer : +2 semaines pour imprévus)

---

### Phase 0 : Instrumentation & Baseline (Semaine 1)

**Objectif** : Mesurer le comportement actuel avant toute modification.

#### Livrables

1. **Télémétrie dans SearchTool**
```typescript
// src/tools/search.ts
class SearchTool {
  async execute(args: any): Promise<ToolResult> {
    const startTime = Date.now();
    const telemetry = {
      pattern: args.pattern,
      filesScanned: 0,
      filesMatched: 0,
      duration: 0,
      tokensEstimated: 0, // Via token-counter.ts
    };

    // ... existing logic ...

    telemetry.duration = Date.now() - startTime;
    this.emitTelemetry(telemetry);

    return result;
  }
}
```

2. **Flag `--context-debug`**
```typescript
// src/index.ts
if (options.contextDebug) {
  process.env.HORUS_CONTEXT_DEBUG = 'true';
  // Log all search/view operations to stderr
}
```

3. **Commande `horus context status`**
```bash
$ horus context status

Context Status
──────────────────────────────────────
Model:              devstral:24b
Context Window:     128K tokens
Current Usage:      12,450 tokens (9.7%)
Files in Context:   8 files
Last Search:        2.3s ago (15 files scanned)
Cache Hit Rate:     N/A (cache not enabled)
```

4. **Baseline metrics**
   - Lancer 10 requêtes test (explain, refactor, debug, implement)
   - Capturer : tokens utilisés, durée totale, nb tours tools, nb fichiers lus
   - Sauvegarder dans `benchmarks/baseline.json`

#### Tests de succès
- ✅ Flag `--context-debug` affiche logs détaillés
- ✅ `horus context status` retourne info exacte
- ✅ Baseline capturée pour comparaison future

---

### Phase 1 : ContextOrchestrator MVP (Semaines 2-3)

**Objectif** : Créer l'orchestrateur minimal qui wrap `HorusAgent`.

#### Livrables

1. **Interfaces TypeScript**
```typescript
// src/types/context.ts
export interface ContextRequest { /* ... */ }
export interface ContextBundle { /* ... */ }
export interface ContextSource {
  type: 'file' | 'snippet' | 'search-result';
  path: string;
  content: string;
  tokens: number;
  metadata: Record<string, any>;
}
```

2. **ContextOrchestrator basique**
```typescript
// src/context/orchestrator.ts
export class ContextOrchestrator {
  private cache: ContextCache;

  constructor(private agent: HorusAgent) {
    this.cache = new ContextCache();
  }

  async gather(request: ContextRequest): Promise<ContextBundle> {
    // MVP : stratégie fixe (agentic search only)
    const sources = await this.agenticSearch(request.query);
    return this.buildBundle(sources);
  }

  private async agenticSearch(query: string): Promise<ContextSource[]> {
    // Use existing SearchTool + TextEditorTool
    const searchResults = await this.agent.executeTool('search_files', {
      pattern: this.extractKeywords(query),
    });

    // Read top 5 files
    const sources: ContextSource[] = [];
    for (const file of searchResults.slice(0, 5)) {
      const content = await this.agent.executeTool('view_file', {
        path: file,
      });
      sources.push({
        type: 'file',
        path: file,
        content,
        tokens: estimateTokens(content),
        metadata: { strategy: 'agentic-search' },
      });
    }

    return sources;
  }
}
```

3. **Intégration dans HorusAgent**
```typescript
// src/agent/horus-agent.ts
export class HorusAgent {
  private orchestrator?: ContextOrchestrator;

  constructor(config: HorusAgentConfig) {
    // ...existing code...

    if (process.env.HORUS_CONTEXT_MODE === 'mvp') {
      this.orchestrator = new ContextOrchestrator(this);
    }
  }

  async processUserMessage(message: string): Promise<void> {
    if (this.orchestrator) {
      // GATHER phase
      const bundle = await this.orchestrator.gather({
        intent: this.detectIntent(message),
        query: message,
        currentContext: this.chatHistory,
        budget: {
          maxTokens: this.getModelMaxContext(),
          reservedForContext: 0.3, // 30% du budget
        },
      });

      // Inject bundle into chat history
      this.injectContextBundle(bundle);
    }

    // ACT phase (existing logic)
    await this.existingProcessLogic(message);

    // VERIFY phase (Phase 4)
  }
}
```

4. **ContextCache LRU**
```typescript
// src/context/cache.ts
import { LRUCache } from 'lru-cache';

export class ContextCache {
  private cache: LRUCache<string, ContextSource>;

  constructor() {
    this.cache = new LRUCache({
      max: 100,
      ttl: 5 * 60 * 1000, // 5 minutes
      updateAgeOnGet: true,
    });
  }

  get(key: string): ContextSource | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: ContextSource): void {
    this.cache.set(key, value);
  }
}
```

#### Tests de succès
- ✅ Mode `HORUS_CONTEXT_MODE=mvp` active l'orchestrateur
- ✅ Mode `off` conserve comportement actuel (régression 0%)
- ✅ Orchestrateur injecte contexte avant appel LLM
- ✅ Cache réduit nb de lectures (mesurer hit rate >20%)

---

### Phase 2 : SearchToolV2 + Scoring (Semaines 4-5)

**Objectif** : Améliorer la pertinence des fichiers sélectionnés.

#### Livrables

1. **Multi-pattern search**
```typescript
// src/tools/search-v2.ts
async search(options: SearchOptions): Promise<SearchResult[]> {
  // Support: ['*.ts', '!*.spec.ts', 'src/**/*.tsx']
  const files = await this.globMultiPattern(options.patterns);
  // ...
}
```

2. **Scoring strategies**

**A. Score by recency (git log)**
```typescript
private async scoreByRecency(files: string[]): Promise<ScoredFile[]> {
  const gitLog = await execAsync('git log --name-only --since="7 days ago"');
  const recentFiles = new Set(gitLog.split('\n'));

  return files.map(f => ({
    path: f,
    score: recentFiles.has(f) ? 10 : 1,
    reasons: recentFiles.has(f) ? ['Modified <7d'] : [],
  }));
}
```

**B. Score by imports (AST léger)**
```typescript
private async scoreByImportGraph(
  files: string[],
  query: string
): Promise<ScoredFile[]> {
  // Fast regex-based import detection (pas de full AST parsing)
  const importRegex = /import.*from\s+['"](.+)['"]/g;

  return files.map(f => {
    const content = fs.readFileSync(f, 'utf-8');
    const imports = [...content.matchAll(importRegex)].map(m => m[1]);

    // Does it import the target file?
    const score = imports.some(imp => query.includes(imp)) ? 20 : 1;

    return { path: f, score, reasons: [] };
  });
}
```

**C. Score by fuzzy match**
```typescript
private scoreByLevenshtein(files: string[], query: string): ScoredFile[] {
  return files.map(f => {
    const basename = path.basename(f, path.extname(f));
    const distance = levenshtein(basename.toLowerCase(), query.toLowerCase());
    const score = Math.max(0, 15 - distance);

    return { path: f, score, reasons: [] };
  });
}
```

3. **Compression structurelle (pas d'appels LLM)**
```typescript
// src/context/snippet-builder.ts
export function buildSnippet(
  filePath: string,
  maxLines: number = 30
): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract important lines (exports, functions, classes, types)
  const important = lines.filter(line => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('export ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('type ')
    );
  });

  if (important.length <= maxLines) {
    return important.join('\n');
  }

  // Chunk by sections
  const header = important.slice(0, 5);
  const footer = important.slice(-5);
  const omitted = important.length - 10;

  return `
// ${filePath} (${important.length} declarations)
${header.join('\n')}

... (${omitted} more declarations omitted)

${footer.join('\n')}
  `.trim();
}
```

#### Tests de succès
- ✅ Multi-pattern search retourne résultats corrects
- ✅ Scoring améliore pertinence (mesurer recall@5 sur corpus test)
- ✅ Snippets réduisent tokens de 60-80% vs fichiers complets

---

### Phase 3 : SubagentManager (Semaines 6-7)

**Objectif** : Permettre parallélisation avec isolation contextuelle.

#### Livrables

1. **SubagentManager**
```typescript
// src/context/subagent-manager.ts
interface SubtaskRequest {
  files: string[];
  instruction: string;
  tools: string[]; // Whitelist des tools autorisés
}

interface SubagentResult {
  summary: string;   // Résumé concis (<500 tokens)
  changes: string[]; // Liste des fichiers modifiés
  duration: number;
}

export class SubagentManager {
  private maxConcurrent = 3; // Limite VRAM

  async spawn(task: SubtaskRequest): Promise<SubagentResult> {
    // Create isolated HorusAgent instance
    const subagent = new HorusAgent({
      ...this.baseConfig,
      chatHistory: [], // Contexte vide
      tools: this.filterTools(task.tools),
      maxTokens: 8192, // Contexte réduit
    });

    // Execute task
    const startTime = Date.now();
    await subagent.processUserMessage(
      `${task.instruction}\n\nFiles: ${task.files.join(', ')}`
    );

    // Extract summary (derniers messages assistant)
    const summary = this.extractSummary(subagent.chatHistory);

    return {
      summary,
      changes: subagent.getModifiedFiles(),
      duration: Date.now() - startTime,
    };
  }

  async spawnParallel(tasks: SubtaskRequest[]): Promise<SubagentResult[]> {
    // Limit concurrency
    const batches = chunk(tasks, this.maxConcurrent);
    const results: SubagentResult[] = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(t => this.spawn(t))
      );
      results.push(...batchResults);
    }

    return results;
  }
}
```

2. **Détection de tâches parallélisables**
```typescript
// src/context/orchestrator.ts
class ContextOrchestrator {
  detectParallelizableTask(request: ContextRequest): SubtaskRequest[] | null {
    // Example: "Refactor all tools to use async/await"
    if (request.intent === 'refactor' && request.query.includes('all')) {
      const toolFiles = glob.sync('src/tools/*.ts');
      const chunks = chunk(toolFiles, 3); // 3 subagents

      return chunks.map(files => ({
        files,
        instruction: request.query,
        tools: ['view_file', 'str_replace_editor', 'replace_lines'],
      }));
    }

    return null;
  }

  async gather(request: ContextRequest): Promise<ContextBundle> {
    const parallelTasks = this.detectParallelizableTask(request);

    if (parallelTasks) {
      // Use subagents
      const results = await this.subagentManager.spawnParallel(parallelTasks);
      return this.buildBundleFromSubagents(results);
    }

    // Fallback: agentic search
    return this.agenticSearch(request);
  }
}
```

#### Tests de succès
- ✅ Subagent spawné avec contexte isolé (vérifié via logs)
- ✅ 3 subagents parallèles ne dépassent pas limite VRAM (monitoring)
- ✅ Résultats agrégés correctement dans contexte principal
- ✅ Pas de nesting (subagent ne peut pas spawner de subagent)

---

### Phase 4 : Verification + UX CLI (Semaines 8-9)

**Objectif** : Boucler le cycle gather-act-verify et rendre le système observable.

#### Livrables

1. **VerificationPipeline**
```typescript
// src/context/verification.ts
export class VerificationPipeline {
  async verify(
    action: ToolResult,
    mode: 'fast' | 'thorough' = 'fast'
  ): Promise<VerificationResult> {
    const checks: VerificationResult['checks'] = {};

    // Lint (fast)
    if (action.filePath?.endsWith('.ts')) {
      checks.lint = await this.runLint(action.filePath);
    }

    // Tests (thorough only)
    if (mode === 'thorough') {
      const testFile = this.findRelatedTest(action.filePath);
      if (testFile) {
        checks.tests = await this.runTests([testFile]);
      }
    }

    return {
      passed: Object.values(checks).every(c => c.passed),
      checks,
      duration: Date.now() - startTime,
    };
  }

  private async runLint(filePath: string): Promise<LintResult> {
    try {
      await execAsync(`eslint ${filePath}`, { timeout: 2000 });
      return { passed: true, issues: [] };
    } catch (error) {
      return {
        passed: false,
        issues: this.parseLintOutput(error.stdout),
      };
    }
  }
}
```

2. **Intégration dans HorusAgent**
```typescript
// src/agent/horus-agent.ts
async processUserMessage(message: string): Promise<void> {
  // GATHER
  if (this.orchestrator) {
    const bundle = await this.orchestrator.gather(...);
    this.injectContextBundle(bundle);
  }

  // ACT
  const result = await this.existingProcessLogic(message);

  // VERIFY
  if (result.toolCalls) {
    for (const call of result.toolCalls) {
      if (this.isFileModification(call)) {
        const verification = await this.verifier.verify(call.result, 'fast');

        if (!verification.passed) {
          // Inject feedback into context
          this.addSystemMessage(
            `⚠️ Verification failed: ${verification.checks.lint?.issues.join(', ')}`
          );

          // Let agent fix (1 retry max)
          await this.processUserMessage('Fix the linting errors above');
        }
      }
    }
  }
}
```

3. **Commandes CLI**

**A. `horus context plan`**
```bash
$ horus context plan --query "Explain how SearchTool works"

Context Plan
────────────────────────────────────────
Intent:         explain
Strategy:       agentic-search
Budget:         30% of 128K tokens = 38,400 tokens

Planned Sources:
  1. src/tools/search.ts (ranked #1, score: 25)
     - Reason: Direct match with query
     - Tokens: ~2,000

  2. src/tools/index.ts (ranked #2, score: 10)
     - Reason: Exports SearchTool
     - Tokens: ~50

  3. src/agent/horus-agent.ts (ranked #3, score: 8)
     - Reason: Uses SearchTool
     - Tokens: ~3,000

Total tokens: 5,050 / 38,400 (13.1%)
Estimated duration: ~1.5s
```

**B. `horus context clear-cache`**
```bash
$ horus context clear-cache

Cleared 42 cached entries (saved ~12,000 tokens)
```

**C. `horus context stats`**
```bash
$ horus context stats --last 5

Recent Context Operations
─────────────────────────────────────────────────────
#1 | 2 min ago | explain
    Strategy: agentic-search
    Sources: 3 files (5,050 tokens)
    Cache hits: 1/3 (33%)
    Duration: 1.2s

#2 | 5 min ago | refactor
    Strategy: subagents (3 parallel)
    Sources: 9 files (18,000 tokens)
    Cache hits: 2/9 (22%)
    Duration: 12.5s

#3 | 10 min ago | debug
    Strategy: cached
    Sources: 2 files (1,200 tokens)
    Cache hits: 2/2 (100%)
    Duration: 0.1s

─────────────────────────────────────────────────────
Avg cache hit rate: 51.7%
Avg tokens per operation: 8,083
Avg duration: 4.6s
```

4. **UI Ink : Context Panel**
```typescript
// src/ui/components/context-panel.tsx
export const ContextPanel: React.FC<{ bundle: ContextBundle }> = ({ bundle }) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan">
      <Text bold color="cyan">
        📦 Context Bundle
      </Text>
      <Text dimColor>
        Strategy: {bundle.metadata.strategy}
      </Text>
      <Text dimColor>
        Files: {bundle.metadata.filesRead}/{bundle.metadata.filesScanned}
      </Text>
      <Text dimColor>
        Tokens: {bundle.metadata.tokensUsed.toLocaleString()}
      </Text>
      <Text dimColor>
        Duration: {bundle.metadata.duration}ms
      </Text>

      <Box marginTop={1}>
        <Text bold>Sources:</Text>
        {bundle.sources.slice(0, 5).map((src, i) => (
          <Text key={i} dimColor>
            {i + 1}. {src.path} ({src.tokens} tokens)
          </Text>
        ))}
      </Box>
    </Box>
  );
};
```

#### Tests de succès
- ✅ Lint check automatique après édition (fast mode)
- ✅ Tests optionnels en mode thorough (flag `--verify=thorough`)
- ✅ Commandes CLI retournent info exacte
- ✅ UI Ink affiche contexte en temps réel

---

### Phase 5 : Tuning Modèles + Benchmarks (Semaine 10)

**Objectif** : Optimiser sélection modèle et valider gains de performance.

#### Livrables

1. **Détection auto VRAM**
```typescript
// src/utils/system-info.ts
export async function detectAvailableVRAM(): Promise<number> {
  try {
    // NVIDIA
    const nvidiaSmi = await execAsync('nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits');
    return parseInt(nvidiaSmi.split('\n')[0]);
  } catch {
    // Fallback: estimate from system RAM
    const totalMem = os.totalmem() / (1024 ** 3); // GB
    return Math.floor(totalMem * 0.5); // Conservative estimate
  }
}
```

2. **Sélection modèle adaptative**
```typescript
// src/horus/model-selector.ts
export function selectOptimalModel(
  contextSize: number,
  availableVRAM: number
): ModelConfig {
  // Large context needed
  if (contextSize > 32000) {
    if (availableVRAM >= 32) return MODELS.devstral; // 128K
    throw new Error('Insufficient VRAM for 128K context');
  }

  // Medium context
  if (contextSize > 16000) {
    if (availableVRAM >= 16) return MODELS.mixtral; // 32K, MoE
    return MODELS['mistral-small']; // 32K, 22B (fallback)
  }

  // Small context
  if (contextSize > 8000) {
    return MODELS['mistral-small']; // 32K, 22B
  }

  // Default: fast & lean
  return MODELS.mistral; // 8K, 7B
}
```

3. **Commande benchmark**
```bash
$ horus context bench --model mistral-small

Running benchmarks for mistral-small...

Test 1: Explain function (simple)
  Context tokens: 2,450
  Response tokens: 342
  Duration: 1.8s
  ✅ PASSED

Test 2: Refactor multi-file (medium)
  Context tokens: 15,200
  Response tokens: 1,120
  Duration: 8.3s
  ✅ PASSED

Test 3: Debug with subagents (complex)
  Context tokens: 28,500
  Response tokens: 2,340
  Duration: 22.1s
  ⚠️  SLOW (expected <15s)

─────────────────────────────────────────
Overall Score: 8.2/10
Recommendation: Suitable for most tasks
              Consider mistral (7B) for speed-critical ops
              Consider mixtral (8x7B) for complex refactors
```

4. **Documentation modèles**
```markdown
# src/docs/model-selection.md

## Modèles Mistral/Ollama pour Horus CLI

### mistral (7B, 8K)
- **VRAM**: 4-6 GB
- **Vitesse**: ⚡⚡⚡⚡⚡ (très rapide)
- **Qualité**: ⭐⭐⭐ (bonne)
- **Use cases**: Navigation fichiers, petites éditions, réponses rapides
- **Commande**: `horus --model mistral`

### mistral-small (22B, 32K)
- **VRAM**: 12-16 GB
- **Vitesse**: ⚡⚡⚡⚡ (rapide)
- **Qualité**: ⭐⭐⭐⭐ (excellente)
- **Use cases**: Refactors multi-fichiers, analyses approfondies
- **Commande**: `horus --model mistral-small` ← **RECOMMANDÉ**

### mixtral (8x7B MoE, 32K)
- **VRAM**: 24-32 GB
- **Vitesse**: ⚡⚡⚡ (moyenne)
- **Qualité**: ⭐⭐⭐⭐⭐ (excellente)
- **Use cases**: Refactors complexes, architecture decisions
- **Commande**: `horus --model mixtral`

### devstral (24B, 128K)
- **VRAM**: 32+ GB
- **Vitesse**: ⚡⚡ (lente)
- **Qualité**: ⭐⭐⭐⭐ (très bonne)
- **Use cases**: Longs contextes, sessions multi-heures
- **Commande**: `horus --model devstral:24b` (default actuel)
```

5. **Update settings**
```typescript
// src/utils/settings-manager.ts
const DEFAULT_USER_SETTINGS: UserSettings = {
  // ... existing ...
  defaultModel: 'mistral-small', // CHANGED from devstral:24b
  modelProfiles: {
    'fast': 'mistral',
    'balanced': 'mistral-small',
    'powerful': 'mixtral',
    'deep': 'devstral:24b',
  },
  contextSettings: {
    autoSelectModel: true, // NEW: enable adaptive selection
    reservedContextPercent: 0.3, // 30% for context
    cacheEnabled: true,
  },
};
```

#### Tests de succès
- ✅ Détection VRAM retourne valeur correcte (± 2GB)
- ✅ Sélection auto choisit modèle approprié (validé manuellement)
- ✅ Benchmarks montrent amélioration vs baseline (Phase 0)
- ✅ Documentation modèles à jour

---

## Stratégie modèles Mistral/Ollama

### Matrice décisionnelle

```
┌─────────────────────────────────────────────────────────────┐
│                    VRAM Disponible                          │
├───────────┬─────────────┬─────────────┬─────────────────────┤
│  < 8 GB   │  8-16 GB    │  16-32 GB   │  32+ GB             │
├───────────┼─────────────┼─────────────┼─────────────────────┤
│           │             │             │                     │
│  mistral  │ mistral-    │  mixtral    │   devstral          │
│   (7B)    │  small      │  (8x7B)     │   (24B, 128K)       │
│           │  (22B)      │             │                     │
│           │             │             │                     │
│  8K ctx   │  32K ctx    │  32K ctx    │   128K ctx          │
│  ~1-2s    │  ~3-5s      │  ~8-12s     │   ~15-30s           │
│  latency  │  latency    │  latency    │   latency           │
│           │             │             │                     │
│  Use:     │  Use:       │  Use:       │   Use:              │
│  - Fast   │  - Most     │  - Complex  │   - Long sessions   │
│    nav    │    tasks    │    refactor │   - Deep analysis   │
│  - Small  │  - Medium   │  - Parallel │   - Multi-hour      │
│    edits  │    refactor │    subagent │     debugging       │
│           │             │                                   │
└───────────┴─────────────┴─────────────┴─────────────────────┘
```

### Configuration Ollama recommandée

**1. Installer les modèles**
```bash
ollama pull mistral
ollama pull mistral-small
ollama pull mixtral
ollama pull devstral:24b
```

**2. Créer des Modelfiles custom**
```bash
# ~/.ollama/models/horus-mistral.modelfile
FROM mistral

PARAMETER num_ctx 8192
PARAMETER temperature 0.2
PARAMETER top_p 0.9

SYSTEM """
You are Horus, a local AI coding assistant. You help developers by:
- Reading and analyzing code files
- Making precise edits using tools
- Explaining complex architectures
- Refactoring code for clarity

Always prefer small, focused changes over large rewrites.
"""
```

```bash
# ~/.ollama/models/horus-mistral-small.modelfile
FROM mistral-small

PARAMETER num_ctx 32768
PARAMETER temperature 0.2
PARAMETER top_p 0.9

# ... same SYSTEM prompt ...
```

**3. Build custom models**
```bash
ollama create horus-mistral -f ~/.ollama/models/horus-mistral.modelfile
ollama create horus-mistral-small -f ~/.ollama/models/horus-mistral-small.modelfile
```

**4. Update Horus settings**
```json
// .horus/settings.json
{
  "currentModel": "horus-mistral-small",
  "models": {
    "horus-mistral": {
      "maxContext": 8192,
      "provider": "ollama"
    },
    "horus-mistral-small": {
      "maxContext": 32768,
      "provider": "ollama"
    }
  }
}
```

### Trade-offs détaillés

| Critère | mistral | mistral-small | mixtral | devstral |
|---------|---------|---------------|---------|----------|
| **Tokens/sec** | 80-120 | 40-60 | 20-30 | 10-15 |
| **Qualité code** | 7/10 | 9/10 | 9.5/10 | 9/10 |
| **Compréhension** | 7/10 | 9/10 | 10/10 | 9.5/10 |
| **Following instructions** | 8/10 | 9/10 | 9/10 | 8.5/10 |
| **Coût compute (CPU)** | LOW | MEDIUM | HIGH | HIGH |
| **Coût VRAM** | 5GB | 14GB | 28GB | 40GB |

**Recommandation générale** : **mistral-small** comme default (meilleur compromis).

---

## Métriques de succès

### Objectifs quantitatifs (vs baseline Phase 0)

| Métrique | Baseline | Target MVP | Target Full |
|----------|----------|------------|-------------|
| **Tokens par réponse** | ~12K | -30% (8.4K) | -50% (6K) |
| **Nb fichiers lus** | ~8 | -40% (4-5) | -60% (3) |
| **Cache hit rate** | 0% | 20% | 50% |
| **Durée search+view** | ~2.3s | <1.5s | <1s |
| **Tours tool loop** | ~6 | -20% (~5) | -40% (~3.5) |
| **Recall@5 pertinence** | N/A | 70% | 85% |

### Objectifs qualitatifs

- ✅ Les développeurs comprennent pourquoi un fichier a été sélectionné (via reasons)
- ✅ Moins de "pourquoi tu lis ce fichier ?" dans les sessions
- ✅ Subagents utilisés automatiquement pour tâches parallèles
- ✅ Vérifications lint ne cassent pas le flow (auto-fix ou feedback clair)
- ✅ Switching modèle transparent (pas de config manuelle)

### Métriques observabilité

**Dashboard (à créer dans Phase 4)** :
```
┌─────────────────────────────────────────────────────────────┐
│  Horus Context Metrics — Last 24h                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Total requests:        142                                 │
│  Avg tokens/request:    7,200 (-40% vs baseline)            │
│  Cache hit rate:        38%                                 │
│  Subagents spawned:     23 (16% of requests)                │
│  Verifications run:     89 (63% of requests)                │
│  Avg response time:     4.2s                                │
│                                                             │
│  Top strategies:                                            │
│    1. agentic-search    78 (55%)                            │
│    2. cached            42 (30%)                            │
│    3. subagents         22 (15%)                            │
│                                                             │
│  Model usage:                                               │
│    - mistral-small      98 (69%)                            │
│    - mistral            32 (23%)                            │
│    - mixtral            12 (8%)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tests de non-régression

**Test suite** (à créer dans Phase 0) :
```typescript
// tests/context-benchmarks.spec.ts
describe('Context System Benchmarks', () => {
  const baseline = loadBaseline('benchmarks/baseline.json');

  it('should not increase avg tokens by >10%', async () => {
    const currentAvg = await runBenchmarks().avgTokens;
    expect(currentAvg).toBeLessThan(baseline.avgTokens * 1.1);
  });

  it('should improve recall@5 by >20%', async () => {
    const recall = await measureRecall(testCorpus);
    expect(recall).toBeGreaterThan(baseline.recall * 1.2);
  });

  it('should have cache hit rate >15%', async () => {
    const hitRate = await measureCacheHitRate();
    expect(hitRate).toBeGreaterThan(0.15);
  });
});
```

---

## Risques et mitigations

### Risques techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Performance régression** | MEDIUM | HIGH | - Phase 0 baseline obligatoire<br>- Tests de non-régression<br>- Feature flag pour rollback |
| **VRAM exhaustion** | MEDIUM | HIGH | - Limiter subagents à 3<br>- Détection VRAM + fallback<br>- Contextes réduits (4-8K) |
| **Cache invalidation bugs** | MEDIUM | MEDIUM | - Tests d'invalidation cascade<br>- TTL court (5min) par défaut<br>- Clear cache manuel |
| **Complexité code** | HIGH | MEDIUM | - Interfaces simples<br>- Décorateur vs réécriture<br>- Documentation inline |
| **Import graph parsing lent** | LOW | MEDIUM | - Regex-based (pas full AST)<br>- Cache résultats<br>- Timeout 2s max |

### Risques produit

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Users préfèrent ancien comportement** | LOW | HIGH | - Feature flag permanent<br>- Sondage early adopters<br>- Docs comparatives |
| **Subagents confusants** | MEDIUM | LOW | - UI claire (panel isolation)<br>- Logs détaillés<br>- Docs exemples |
| **Modèle auto-select incorrect** | MEDIUM | MEDIUM | - Override manuel toujours possible<br>- Logs décision<br>- Feedback loop |

---

## Checklist de livraison

### Phase 0 ✅
- [ ] Télémétrie SearchTool implémentée
- [ ] Flag `--context-debug` fonctionnel
- [ ] Commande `horus context status` créée
- [ ] Baseline metrics capturées (`benchmarks/baseline.json`)
- [ ] Tests de non-régression écrits

### Phase 1 ✅
- [ ] Interfaces TypeScript définies (`src/types/context.ts`)
- [ ] `ContextOrchestrator` MVP implémenté
- [ ] `ContextCache` LRU avec TTL
- [ ] Intégration dans `HorusAgent` avec feature flag
- [ ] Tests unitaires orchestrateur
- [ ] Mode `off` ne régresse rien (vérifié)

### Phase 2 ✅
- [ ] `SearchToolV2` multi-pattern
- [ ] Scoring strategies (recency, imports, fuzzy)
- [ ] Compression structurelle snippets
- [ ] Tests recall@5 sur corpus
- [ ] Documentation scoring heuristics

### Phase 3 ✅
- [ ] `SubagentManager` implémenté
- [ ] Limite 3 subagents parallèles
- [ ] Détection tâches parallélisables
- [ ] Tests isolation contexte
- [ ] Monitoring VRAM usage

### Phase 4 ✅
- [ ] `VerificationPipeline` (lint + tests)
- [ ] Intégration dans boucle gather-act-verify
- [ ] Commandes CLI (`plan`, `clear-cache`, `stats`)
- [ ] UI Ink context panel
- [ ] Documentation complète

### Phase 5 ✅
- [ ] Détection VRAM auto
- [ ] Sélection modèle adaptative
- [ ] Commande `horus context bench`
- [ ] Modelfiles custom Ollama
- [ ] Mise à jour default model (`mistral-small`)
- [ ] Documentation modèles

---

## Ressources et références

### Documentation Anthropic
- [Building agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)

### Claude Code
- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code)
- [Managing Claude Code's Context (practical guide)](https://www.cometapi.com/managing-claude-codes-context/)
- [Subagents architecture](https://www.infoq.com/news/2025/08/claude-code-subagents/)

### Ollama
- [Ollama Mistral models](https://ollama.com/library/mistral)
- [Context window optimization](https://localllm.in/blog/local-llm-increase-context-length-ollama)
- [Performance tuning guide](https://sebastianpdw.medium.com/common-mistakes-in-local-llm-deployments-03e7d574256b)

### Techniques
- [Late Chunking (contextual embeddings)](https://arxiv.org/abs/2409.04701)
- [BM25 & TF-IDF basics](https://en.wikipedia.org/wiki/Okapi_BM25)

---

## Notes finales

### Principe KISS (Keep It Simple, Stupid)

Ce plan a été **drastiquement simplifié** par rapport au TODO.md initial :

**Éliminé** :
- ❌ Résumés via appels LLM (trop coûteux local)
- ❌ Reranking BM25 complet (complexe, ROI incertain)
- ❌ Embeddings vectoriels (pas de modèle local fiable)
- ❌ Persistent indexing (contraire à la philosophie Claude Code)

**Conservé** :
- ✅ Agentic search (grep/view incrémentaux)
- ✅ Cache LRU simple
- ✅ Compression structurelle (AST léger)
- ✅ Subagents isolés (max 3 parallèles)
- ✅ Vérifications rules-based (lint/test)

### Prochaines étapes (post-MVP)

Après livraison des 5 phases, considérer :

1. **MCP servers pour contexte externe** (ex: GitHub API, Jira)
2. **Persistent conversation summaries** (sauvegarder résumés entre sessions)
3. **Visual feedback** (screenshots pour UI work, si applicable)
4. **Custom heuristics per-project** (via `.horus/context.config.ts`)
5. **Telemetry dashboard web** (visualiser métriques en temps réel)

---

**Date de création** : 2025-01-21
**Version** : 1.0 (MVP-focused)
**Auteur** : Claude Code + Recherches Anthropic 2024-2025
**Status** : 🚧 Ready for Phase 0
