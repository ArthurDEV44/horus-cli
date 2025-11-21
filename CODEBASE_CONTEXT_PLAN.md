# Plan d’action — Système de contexte agentique pour `horus-cli-ts`

## Résumé exécutif
- Doter Horus d’un orchestrateur de contexte à la demande (lecture ciblée + recherche incrémentale) afin d’imiter la boucle *gather → act → verify* popularisée par Claude Code, sans indexation persistante ni base vectorielle dédiée.[^anth-agent-sdk]
- Structurer l’implémentation en phases livrables (instrumentation, orchestration, ranking, compression, UX, tuning modèles) pour réduire le risque sur la dette technique actuelle (`SearchTool`, `HorusAgent`, `HorusClient`).
- Garantir une expérience *Made in France* en recommandant un portefeuille de modèles Mistral disponibles dans Ollama pour différentes enveloppes de ressources (latence vs. profondeur d’analyse).[^ollama-mistral][^ollama-mistral-small][^ollama-mixtral][^ollama-magistral][^ollama-devstral]

## 1. Diagnostic rapide de la base de code
- **Boucle agentique actuelle** : `HorusAgent` orchestre les tours outil via `HorusClient`, mais ne conserve aucun graphe de contexte persistant ; chaque réponse repart de l’historique brut des messages.
- **Recherche** : `SearchTool` (`src/tools/search.ts`) effectue une marche récursive naïve (regex/glob maison) limitée à 100 résultats, sans score ni cache ; aucune notion de « requête composite » ou de priorisation par type de fichier.
- **Lecture/édition** : `TextEditorTool` offre `view`, `create`, `strReplace`, `replaceLines` et `Morph` (optionnel) mais ne fournit pas de résumés ni de snippets compressés pour l’IA.
- **Paramétrage** : `SettingsManager` et `HorusClient` gèrent la sélection modèle/Ollama mais ne taguent pas les échanges avec des métadonnées (chemins consultés, coût estimé en tokens) utiles pour piloter un plan de contexte.
- **UX** : aucune commande CLI ne donne de visibilité sur « ce qui a été lu » ou sur les heuristiques de sélection de fichiers (contrairement aux workflows décrits dans les docs Claude Code).[^\_claude-overview][^\_claude-workflows][^\_claude-cli]

## 2. Principes directeurs inspirés de Claude Code
1. **Boucle *gather → act → verify*** : isoler un orchestrateur qui planifie quelles sources lire/searcher avant chaque appel modèle, applique les actions, puis valide le résultat (tests, lint, diff) avant de répondre.[^anth-agent-sdk]
2. **Agentic search sans index** : privilégier des appels `search`/`bash`/`view` incrémentaux, en tenant un *context ledger* mémoire (chemins déjà explorés, score de pertinence) plutôt qu’une base vectorielle externe, comme l’impose Claude Code pour rester léger/offline.[^\_claude-overview]
3. **Contextualisation progressive** : intégrer des techniques de *Contextual Retrieval* (réécriture de requêtes, reranking BM25-like, snippets ciblés) afin de maximiser les rappels pertinents tout en maîtrisant la fenêtre de contexte.[^anth-contextual]
4. **Traçabilité CLI** : exposer les décisions du planificateur (fichiers scannés, tokens consommés, étapes effectuées) via de nouvelles commandes `horus context:*`, à l’image des capacités d’inspection fournies par le CLI Claude Code.[^\_claude-cli]

## 3. Architecture cible

```
User Prompt
   ↓
ContextPlanner (nouveau) ──┬─→ QueryPlanner (stratégies)
                           │
                           ├─→ Search Executors (SearchTool/Bash/MCP)
                           │        ↓
                           │    ContextCache (MRU, TTL)
                           │        ↓
                           └─→ SnippetBuilder (résumés, extraits, métadonnées)
                                    ↓
                             HorusClient (LLM call)
                                    ↓
                           Verifiers (lint/tests/git status)
```

### 3.1 Composants à introduire
- **`ContextPlanner` (nouveau module `src/context/`)** : interface pour recevoir une intention (ex. *expliquer fonction*, *appliquer refactor*), orchestrer les stratégies de recherche, agréger les snippets et restituer un `ContextBundle`.
- **`QueryPlanner`** : heuristiques (patterns de fichiers, dépendances import/export, proximité de tests) ; possibilité d’exposer un hook `context.config.ts` pour surcharger les priorités par repo.
- **`ContextCache`** : LRU en mémoire (clé = hash fichier + plage lignes) + compteur de tokens économisés ; invalidation sur `fs.watch` ou via `git status`.
- **`SnippetBuilder`** : découpe les chunks (<N lignes), ajoute des en-têtes (`// file: path`, `// summary:`), applique compression (Chain-of-Thought, bullet) selon budget contextuel issu de `getModelMaxContext`.
- **`VerificationAdapters`** : pipeline post-action (lint ciblé, tests rapides, watchers) pour implémenter la phase *verify* systématiquement.

## 4. Roadmap d’implémentation (6 phases)

| Phase | Objectif | Livrables clés |
|-------|----------|----------------|
| **0. Instrumentation & garde-fous** | Observer le comportement actuel avant refonte | - Hooks de télémétrie dans `SearchTool` (durée, nb de fichiers, tokens estimés)<br>- Flag `--context-debug` sur `horus` pour logguer les recherches<br>- Commande `horus context status` (afficher modèle, budget tokens, tours réalisés) |
| **1. ContextPlanner MVP** | Encapsuler les appels search/view | - Module `src/context/planner.ts` + interface `ContextRequest`<br>- Intégration dans `HorusAgent` avant chaque appel modèle (option `--context-mode=mvp`)<br>- Tests unitaires simulant différentes intentions |
| **2. Heuristiques & ranking** | Prioriser les fichiers et limiter les lectures | - Scoring basique (poids = extension + proximité import/export)<br>- Prise en charge de requêtes multi-pattern avec `SearchTool` amélioré (regex composées, include/exclude multiples)<br>- Pré-sélection de tests associés (via conventions `*.spec.ts`, `__tests__`) |
| **3. Compression & contextual retrieval light** | Maximiser la densité d’information | - `SnippetBuilder` avec titres + résumés (appels LLM courts)<br>- Implémentation d’un reranking BM25-like / tf-idf maison inspiré du billet Contextual Retrieval<br>- Budgetisation automatique (pourcentage du contexte réservé aux snippets vs instructions) |
| **4. UX & commandes CLI** | Rendre le système pilotable | - Commandes `horus context plan`, `horus context clear-cache`, `horus context replay`<br>- Surfaces UI (Ink) affichant: fichiers lus, heuristique utilisée, token usage cumulé<br>- Documentation dans `README.md` + `MODERN_UI.md` |
| **5. Vérification & modèles** | Renforcer la fiabilité | - Hooks automatiques lint/test déclenchés par le planner selon le type d’intention<br>- Benchmarks comparatifs des modèles Mistral (cf. §5) et mise à jour des valeurs par défaut dans `SettingsManager`<br>- Guide d’adoption + rétrocompatibilité (feature flag `HORUS_CONTEXT_MODE`) |

## 5. Sélection des modèles Mistral sur Ollama

| Modèle Ollama | Taille fenêtre / perfs (indicatif) | Cas d’usage recommandé | Remarques |
|---------------|------------------------------------|------------------------|-----------|
| `mistral` | ~8K tokens, 7B params | Requêtes rapides, navigation fichier par fichier | Latence faible, bon compromis CPU/GPU.[^ollama-mistral] |
| `mistral-small` | ~32K tokens, 22-24B params | Résumés + refactors multi-fichiers | Demande plus de VRAM mais reste local et français-friendly.[^ollama-mistral-small] |
| `mixtral` | MoE 8x7B, ~32K tokens | Grosses refontes / analytiques parallèles | Bénéficie de *routing* dynamique, idéal pour context packing.[^ollama-mixtral] |
| `magistral` | Variante fine-tunée code FR | Tâches orientées écosystème français/réglementaire | Complément culturel/local pour réponses juridiques ou docs FR.[^ollama-magistral] |
| `devstral` | 128K tokens (valeur par défaut actuelle) | Longs contextes / sessions multi-heures | Reste notre fallback quand la profondeur prime sur la latence.[^ollama-devstral] |

Actions à prévoir :
1. Ajouter ces modèles dans `DEFAULT_USER_SETTINGS.models` + documentation.
2. Offrir un preset `horus --model-profile mistral-balanced` qui sélectionne automatiquement le modèle adapté selon le budget contexte demandé par le planner.
3. Benchmarks internes (temps/tokens) déclenchés via `horus context bench --model <…>` pour suivre l’évolution réelle.

## 6. Validation, tests et métriques
- **Métriques clés** : taux de rappel des fichiers pertinents (mesuré sur un corpus de requêtes de test), tokens moyens par réponse, temps médian `search+view`, ratio d’échecs *tool loop*.
- **Tests automatisés** :
  - Jeux de requêtes synthétiques (ex. « expliquer fonction », « corriger test ») + snapshots du plan généré.
  - Tests d’intégration CLI `horus context plan --dry-run` vérifiant la sortie textuelle.
  - Tests de régression sur `SearchTool` garantissant l’exclusion des répertoires lourds (`node_modules`, `dist`, etc.).
- **Process QA** : inclure le planner dans les workflows CI (`horus --prompt "run context smoke"`) pour vérifier qu’aucune régression n’augmente les tokens > X %.

## 7. TODO immédiat (Semaine 1)
1. Implémenter l’instrumentation Phase 0 et exposer `horus context status`.
2. Définir l’API `ContextPlanner` + interfaces (`ContextRequest`, `ContextSource`, `ContextSnippet`).
3. Rédiger la documentation interne (`docs/context-system.md`) décrivant la convention d’extensions / heuristiques.

---

[^anth-agent-sdk]: [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
[^anth-contextual]: [Introducing Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
[^ollama-mistral]: [Ollama — mistral](https://ollama.com/library/mistral)
[^ollama-mistral-small]: [Ollama — mistral-small](https://ollama.com/library/mistral-small)
[^ollama-mixtral]: [Ollama — mixtral](https://ollama.com/library/mixtral)
[^ollama-magistral]: [Ollama — magistral](https://ollama.com/library/magistral)
[^ollama-devstral]: [Ollama — devstral](https://ollama.com/library/devstral)
[^_claude-overview]: [Claude Code — Overview](https://code.claude.com/docs/en/overview)
[^_claude-workflows]: [Claude Code — Common workflows](https://code.claude.com/docs/en/common-workflows)
[^_claude-cli]: [Claude Code — CLI reference](https://code.claude.com/docs/en/cli-reference)

