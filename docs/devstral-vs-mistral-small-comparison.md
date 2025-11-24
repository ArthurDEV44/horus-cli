# Devstral vs Mistral Small 3.1 : Comparaison Technique pour Horus CLI

**Date** : 2025-01-24
**Objectif** : Déterminer le modèle optimal par défaut pour Horus CLI

---

## 📊 Résumé Exécutif

### 🏆 Recommandation : **Devstral 24B**

**Devstral est le choix optimal** pour Horus CLI car il est :
- ✅ **Spécialisé pour agents de code** (fine-tuné de Mistral Small 3.1 spécifiquement pour agentic coding)
- ✅ **46.8% SWE-Bench Verified** (meilleur open-source, +20% vs GPT-4.1-mini)
- ✅ **Même taille et contexte** (24B, 128K tokens) que Mistral Small
- ✅ **Support fonction calling** (format Mistral + XML)
- ✅ **Optimisé pour exploration codebase** (cas d'usage principal d'Horus)

---

## 🔬 Comparaison Détaillée

### Architecture & Spécifications

| Caractéristique | Devstral 24B | Mistral Small 3.1 |
|----------------|--------------|-------------------|
| **Paramètres** | 24B | 24B |
| **Context Window** | 128K tokens | 32K (3.1) / 128K (variant 22B) |
| **Base Model** | Fine-tuné de Mistral Small 3.1 | Base |
| **Licence** | Apache 2.0 | Apache 2.0 |
| **Modalités** | Text-only | Multimodal (text + vision) |
| **Tokenizer** | Tekken (131K vocab) | Tekken (131K vocab) |

**Insight clé** : Devstral est un **variant spécialisé** de Mistral Small 3.1, avec l'encodeur vision retiré pour optimiser les performances coding.

---

### Benchmarks de Code

#### Traditional Coding Benchmarks

| Benchmark | Devstral 24B | Mistral Small 3.1 | Mistral Small 3.2 |
|-----------|-------------|-------------------|-------------------|
| **HumanEval** | ~88% (estimé) | ~88% | ~93% |
| **MBPP** | ~74% (estimé) | ~74% | ~78% |

**Note** : Devstral hérite des performances de Mistral Small 3.1 sur HumanEval/MBPP car fine-tuné du même base model.

#### Agentic Coding Benchmarks (Critical for Horus CLI)

| Benchmark | Devstral 24B | Mistral Small 3.1 | Comparaison |
|-----------|-------------|-------------------|-------------|
| **SWE-Bench Verified** | **46.8%** | N/A (non optimisé) | Devstral #1 open-source |
| **SWE-Bench 1.1** | **53.6%** | N/A | +6.8% vs Devstral 1.0 |
| **vs GPT-4.1-mini** | **+20%** | N/A | Surpasse GPT-4 |
| **vs Deepseek-V3 (671B)** | **Supérieur** | N/A | Bat des modèles 20x plus gros |

**Conclusion** : Devstral **domine** sur les tâches d'agents de code (exploration codebase, multi-file editing, résolution d'issues GitHub).

---

### Capacités Spécialisées

#### Devstral 24B - Optimisé pour Agentic Coding

**Forces** :
- ✅ **Exploration de codebase** : Identifie relations entre composants disparates
- ✅ **Édition multi-fichiers** : Modifications coordonnées à travers la codebase
- ✅ **Détection de bugs subtils** : Analyse fonctions intriquées
- ✅ **Résolution d'issues réelles** : Entraîné sur GitHub issues réels
- ✅ **Fonction calling** : Support format Mistral + XML

**Use cases** :
- Software engineering agents (Horus CLI ✅)
- Codebase exploration (Horus context orchestrator ✅)
- Multi-file refactoring (TextEditorTool ✅)
- Bug fixing (VerificationPipeline ✅)

#### Mistral Small 3.1 - Généraliste avec Multimodal

**Forces** :
- ✅ **Multimodal** : Text + Vision (images)
- ✅ **Fonction calling rapide** : Low latency
- ✅ **Multilingual** : 10+ langues
- ✅ **Généraliste** : Conversational, Q&A, general knowledge
- ✅ **Vitesse** : 150 tokens/sec

**Use cases** :
- Virtual assistants
- Document verification (images)
- Customer service
- Fine-tuning pour domaines spécifiques (médical, légal)

---

### Performance Benchmarks (SWE-Bench Context)

**Test scaffold OpenHands** :

| Modèle | Taille | Score SWE-Bench | Note |
|--------|--------|-----------------|------|
| **Devstral 24B** | 24B | **46.8%** | 🏆 Meilleur open-source |
| Deepseek-V3 | 671B | <46.8% | Bat par Devstral |
| Qwen3 | 232B | <46.8% | Bat par Devstral |
| GPT-4.1-mini | ? | ~39% (estimé) | -20% vs Devstral |
| Mistral Small 3.1 | 24B | N/A | Non optimisé pour SWE-Bench |

**Source** : [Mistral AI Devstral announcement](https://mistral.ai/news/devstral)

---

### Contexte d'Utilisation Horus CLI

#### Architecture Horus : Gather-Act-Verify Loop

```
1. GATHER (ContextOrchestrator)
   - Agentic search (grep, bash, view)
   - SearchToolV2 avec scoring
   - SnippetBuilder compression

2. ACT (ToolExecutor)
   - TextEditorTool (view, create, str_replace)
   - BashTool
   - Fonction calling MCP

3. VERIFY (VerificationPipeline)
   - Lint
   - Tests
   - Type checking
```

#### Quelle capacité est critique ?

| Capacité | Importance Horus | Devstral | Mistral Small |
|----------|------------------|----------|---------------|
| **Exploration codebase** | 🔥 CRITIQUE | ✅ Excellent | ⚠️ Bon |
| **Multi-file editing** | 🔥 CRITIQUE | ✅ Excellent | ⚠️ Bon |
| **Fonction calling (tools)** | 🔥 CRITIQUE | ✅ Oui | ✅ Oui |
| **Context window long** | 🔥 CRITIQUE | ✅ 128K | ⚠️ 32K (3.1) |
| **Code generation** | 🟡 Important | ✅ 88% HumanEval | ✅ 88% HumanEval |
| **Multimodal (images)** | ❌ Non requis | ❌ Non | ✅ Oui |
| **Conversational** | 🟢 Nice-to-have | ✅ Oui | ✅ Oui |

**Conclusion** : Devstral **couvre toutes les capacités critiques** d'Horus CLI, avec performance supérieure sur exploration codebase.

---

### Ressources Système

| Métrique | Devstral 24B | Mistral Small 3.1 |
|----------|-------------|-------------------|
| **VRAM minimum** | 32-40 GB | 12-16 GB (3.1) / 32-40 GB (22B) |
| **RAM (sans GPU)** | 32 GB | 32 GB |
| **Hardware requis** | RTX 4090 ou Mac 32GB | RTX 3090 ou Mac 16GB (3.1) |

**Note** : Devstral a les **mêmes** exigences que Mistral Small 22B (128K variant), car même taille (24B).

---

### Disponibilité & Deployment

| Plateforme | Devstral 24B | Mistral Small 3.1 |
|------------|-------------|-------------------|
| **Ollama** | ✅ `ollama run devstral` | ✅ `ollama run mistral-small` |
| **HuggingFace** | ✅ mistralai/Devstral-Small-2507 | ✅ mistralai/Mistral-Small-3.1 |
| **API Mistral** | ✅ $0.1/M input, $0.3/M output | ✅ $0.1/M input, $0.3/M output |
| **LM Studio** | ✅ | ✅ |
| **Local** | ✅ 100% privé | ✅ 100% privé |

**Pricing** : Identique (même base model).

---

## 🎯 Recommandation pour Horus CLI

### Choix Optimal : **Devstral 24B**

**Justification** :

1. **Spécialisé pour Horus use case** ✅
   - Exploration codebase = phase GATHER
   - Multi-file editing = TextEditorTool
   - Agent workflows = boucle gather-act-verify

2. **Performance supérieure mesurée** ✅
   - 46.8% SWE-Bench (meilleur open-source)
   - Bat GPT-4.1-mini de 20%
   - Surpasse modèles 20x plus gros

3. **Même coût compute** ✅
   - 24B paramètres (identique Mistral Small)
   - 128K context (identique variant 22B)
   - Ollama support identique

4. **Fine-tuné du meilleur généraliste** ✅
   - Base = Mistral Small 3.1 (88% HumanEval)
   - Hérite des capacités générales
   - Spécialisé en + pour coding agents

5. **Context window maximal** ✅
   - 128K tokens (vs 32K Mistral Small 3.1)
   - Critique pour large codebases
   - Permet phase GATHER plus profonde

**Trade-offs acceptables** :
- ❌ Pas de multimodal (vision) → Horus n'en a pas besoin
- ❌ Peut-être légèrement plus lent en chat conversationnel → Horus focus sur coding tasks

---

### Configuration Recommandée

#### Default Settings Update

**Fichier** : `src/utils/settings-manager.ts`

```typescript
const DEFAULT_USER_SETTINGS: Partial<UserSettings> = {
  baseURL: "http://localhost:11434/v1",
  defaultModel: "devstral", // ✅ UPDATED (was "mistral-small")
  models: [
    "mistral",        // Fast (7B, 8K)
    "mistral-small",  // Balanced généraliste (22B, 32K)
    "devstral",       // 🏆 RECOMMENDED for coding (24B, 128K)
    "mixtral",        // Powerful multi-task (8x7B, 32K)
    "deepseek-coder-v2:16b",
    "qwen2.5-coder:14b",
  ],
};

const DEFAULT_PROJECT_SETTINGS: Partial<ProjectSettings> = {
  model: "devstral", // ✅ UPDATED (was "mistral-small")
};
```

**Fichier** : `src/horus/client.ts`

```typescript
export class HorusClient {
  private currentModel: string = "devstral"; // ✅ UPDATED (was "devstral:24b")
  // ...
}
```

#### Model Selector Update

**Fichier** : `src/horus/model-selector.ts`

```typescript
export const MISTRAL_MODELS = {
  mistral: {
    name: 'mistral',
    vramMin: 4,
    context: 8192,
    speed: 3,
    quality: 2,
  },
  'mistral-small': {
    name: 'mistral-small',
    vramMin: 12,
    context: 32768,
    speed: 2,
    quality: 3,
  },
  'devstral': { // ✅ ADDED
    name: 'devstral',
    vramMin: 32,
    context: 131072, // 128K
    speed: 2,
    quality: 4, // Meilleur pour coding
  },
  'mixtral': {
    name: 'mixtral',
    vramMin: 24,
    context: 32768,
    speed: 1,
    quality: 4,
  },
};

export const MODEL_PROFILES: Record<string, string> = {
  fast: 'mistral',
  balanced: 'mistral-small', // Généraliste
  powerful: 'devstral', // ✅ UPDATED (was 'mixtral') - Best for coding
  deep: 'devstral', // ✅ UPDATED (was 'devstral:24b') - Max context
};
```

---

### Migration Path

**Step 1** : Update default model
```typescript
// DEFAULT_USER_SETTINGS.defaultModel
"mistral-small" → "devstral"
```

**Step 2** : Update HorusClient default
```typescript
// HorusClient.currentModel
"devstral:24b" → "devstral"
```

**Step 3** : Update model-selector profiles
```typescript
// MODEL_PROFILES
powerful: "mixtral" → "devstral"
deep: "devstral:24b" → "devstral"
```

**Step 4** : Update documentation
- README.md : Mention Devstral comme recommandé
- CLAUDE.md : Update default model references
- docs/model-selection.md : Add Devstral comparison section

---

## 📚 Sources

### Documentation Officielle
- [Ollama Devstral](https://ollama.com/library/devstral)
- [Ollama Mistral Small](https://ollama.com/library/mistral-small)
- [Mistral AI - Devstral Announcement](https://mistral.ai/fr/news/devstral)
- [Mistral AI - Mistral Small 3.1 Announcement](https://mistral.ai/fr/news/mistral-small-3-1)

### Research & Benchmarks
- [Mistral AI - Devstral 2507 Upgrade](https://mistral.ai/news/devstral-2507)
- [AI Native Dev - Devstral Analysis](https://ainativedev.io/news/devstral)
- [Devstral SWE-Bench Results](https://adam.holter.com/devstral-small-2507-mistral-ais-agentic-coding-llm-just-destroyed-the-swe-bench/)
- [Mistral Small 3.1 vs Devstral Comparison](https://model.aibase.com/compare/mistral-small-3.1-vs-devstral-small)

### Community & Comparisons
- [Magistral vs Devstral vs DeepSeek R1](https://blog.getbind.co/2025/07/20/magistral-vs-devstral-vs-deepseek-r1-which-is-best/)
- [Mistral Small 3.2 Benchmarks](https://openlaboratory.ai/models/mistral-small-3_2-24b-instruct-2506)

---

## 🔄 Next Steps

1. ✅ **Update default model** dans settings-manager.ts
2. ✅ **Update HorusClient** default model
3. ✅ **Update model-selector** profiles (powerful/deep)
4. 📝 **Update documentation** (README, CLAUDE.md)
5. 🧪 **Test Devstral** avec prompts Horus typiques
6. 📊 **Capture benchmarks** avec Devstral vs Mistral Small

---

**Conclusion Finale** : Devstral est le choix **objectivement supérieur** pour Horus CLI car spécialement conçu pour les agents de code, avec performances SWE-Bench prouvées et même coût compute que Mistral Small.
