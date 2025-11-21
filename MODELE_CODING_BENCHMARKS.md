# 🚀 Modèles Ollama Optimisés pour le Coding (Éditeur CLI)

## 📋 Contexte

Vous cherchez un modèle **puissant pour des tâches de coding** similaires à Cursor IDE, Claude Code, ou Codex. Ce document présente les meilleurs modèles Ollama spécialisés en génération de code avec leurs benchmarks.

---

## 🏆 Top Modèles Recommandés pour le Coding

### 🥇 **1. devstral** - Best Open Source Coding Agent

**Tags** : `tools 24b`  
**Pulls** : 410.1K  
**Taille** : 24B paramètres  
**Description** : "the best open source model for coding agents"

**Points Forts** :
- ✅ **Spécialement conçu pour les agents de coding**
- ✅ Support tool calling natif
- ✅ Format OpenAI compatible
- ✅ Optimisé pour les tâches complexes de développement

**Commandes** :
```bash
ollama pull devstral:24b
```

**Benchmarks** :
- Conçu pour surpasser les modèles généraux en tâches de coding
- Optimisé pour les workflows de développement (refactoring, debugging, génération)

**Recommandation** : ⭐⭐⭐⭐⭐ **TOP CHOIX pour éditeur CLI**

---

### 🥈 **2. deepseek-coder-v2** - Competitive with GPT-4 Turbo

**Tags** : `16b 236b` (MoE)  
**Pulls** : 1.1M  
**Taille** : 16B activés (236B total MoE)  
**Description** : "An open-source Mixture-of-Experts code language model that achieves performance comparable to GPT4-Turbo in code-specific tasks"

**Points Forts** :
- ✅ **Performance comparable à GPT-4 Turbo** sur tâches de code
- ✅ Architecture MoE (efficace)
- ✅ Spécialisé code (entraîné sur 2 trillion tokens de code)
- ✅ Support 80+ langages de programmation

**Commandes** :
```bash
ollama pull deepseek-coder-v2:16b    # Recommandé (16B activés)
ollama pull deepseek-coder-v2:236b   # Plus puissant (MoE complet)
```

**Benchmarks** :
- Surpasse CodeLlama et modèles similaires
- HumanEval : Scores élevés (> 70% pass@1)
- MBPP : Performances excellentes

**Recommandation** : ⭐⭐⭐⭐⭐ **Excellente alternative**

---

### 🥉 **3. qwen2.5-coder** - Latest Code-Specific Qwen

**Tags** : `tools 0.5b 1.5b 3b 7b 14b 32b`  
**Pulls** : 7.8M  
**Taille** : Multiple (7B, 14B, 32B recommandés)

**Points Forts** :
- ✅ **Dernière série Code-Specific** de Qwen
- ✅ Améliorations significatives en génération, raisonnement et correction de code
- ✅ Support tool calling
- ✅ Bon équilibre performance/taille

**Commandes** :
```bash
ollama pull qwen2.5-coder:7b     # Équilibre taille/performance
ollama pull qwen2.5-coder:14b    # Plus puissant
ollama pull qwen2.5-coder:32b    # Maximum (si RAM suffisante)
```

**Benchmarks** :
- HumanEval : Scores compétitifs avec CodeLlama 7B+
- MBPP : Bonnes performances
- CodeXGLUE : Améliorations vs Qwen2.5 standard

**Recommandation** : ⭐⭐⭐⭐ **Excellent pour usage général**

---

### 🎯 **4. deepseek-coder** - Classic Code Specialist

**Tags** : `1.3b 6.7b 33b`  
**Pulls** : 1.5M  
**Taille** : 33B paramètres (version complète)  
**Description** : "DeepSeek Coder is a capable coding model trained on two trillion code and natural language tokens"

**Points Forts** :
- ✅ Entraîné sur **2 trillion tokens** de code et langage naturel
- ✅ Spécialisé GitHub (corpus massif)
- ✅ Support 80+ langages
- ✅ Très populaire et bien testé

**Commandes** :
```bash
ollama pull deepseek-coder:33b   # Version complète (recommandée)
ollama pull deepseek-coder:6.7b  # Version plus légère
```

**Benchmarks** (33B) :
- HumanEval : ~73% pass@1
- MBPP : ~76% pass@1
- Surpasse CodeLlama 34B et GPT-3.5 Turbo sur certaines tâches

**Recommandation** : ⭐⭐⭐⭐ **Classique fiable**

---

### 🔥 **5. codestral** - Mistral AI Code Model

**Tags** : `22b`  
**Pulls** : 491.7K  
**Taille** : 22B paramètres  
**Description** : "Codestral is Mistral AI's first-ever code model designed for code generation tasks"

**Points Forts** :
- ✅ **Premier modèle code de Mistral AI**
- ✅ Conçu spécifiquement pour génération de code
- ✅ Précis, rapide, faible empreinte mémoire
- ✅ Support 80+ langages
- ⚠️ **Licence restrictive** : Usage limité à recherche/tests (pas commercial)

**Commandes** :
```bash
ollama pull codestral:22b
```

**Benchmarks** :
- Performances très élevées sur HumanEval
- Rapidité d'exécution optimisée
- Compréhension contextuelle avancée

**Recommandation** : ⭐⭐⭐⭐ (mais ⚠️ **licence restrictive**)

---

### 🌟 **6. qwen3-coder** - Alibaba's Latest Agentic Code Model

**Tags** : `tools cloud 30b 480b`  
**Pulls** : 526.3K  
**Taille** : 30B (local), 480B (cloud)  
**Description** : "Alibaba's performant long context models for agentic and coding tasks"

**Points Forts** :
- ✅ **Spécialement conçu pour tâches agentiques**
- ✅ Long contexte (idéal pour gros projets)
- ✅ Format tool calling
- ⚠️ Version 30B en local, 480B nécessite cloud

**Commandes** :
```bash
ollama pull qwen3-coder:30b    # Version locale
```

**Recommandation** : ⭐⭐⭐⭐ Si besoin de long contexte

---

### 💪 **7. gpt-oss:20b** - OpenAI's Open Model

**Tags** : `tools thinking 20b 120b`  
**Pulls** : 3.6M  
**Taille** : 20B paramètres

**Points Forts** :
- ✅ Développé par OpenAI (format natif garanti)
- ✅ Support tool calling
- ✅ Bon équilibre général (pas spécialisé code mais polyvalent)

**Commandes** :
```bash
ollama pull gpt-oss:20b
```

**Recommandation** : ⭐⭐⭐⭐ Pour usage polyvalent avec tool calling

---

## 📊 Comparaison des Performances Coding

### Benchmarks Standards

| Modèle | Taille | Context Max | HumanEval | MBPP | Tool Calling | Licence | Recommandation |
|--------|--------|-------------|-----------|------|--------------|---------|----------------|
| **devstral:24b** | 24B | **128K** 🔥 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Natif | Open | 🏆 **TOP CHOIX** |
| **deepseek-coder-v2:16b** | 16B MoE | **160K** 🚀 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | Open | 🥈 Excellent |
| **qwen2.5-coder:32b** | 32B | **128K** 🔥 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ | Open | 🥉 Polyvalent |
| **qwen3-coder:30b** | 30B | **128K** 🔥 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ | Open | 🔍 Agentique |
| **gpt-oss:20b** | 20B | **128K** 🔥 | ⭐⭐⭐ | ⭐⭐⭐ | ✅ | Open | 💡 Général |
| **codestral:22b** | 22B | 32K | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ | ⚠️ Restrictive | ⚠️ Licence |
| **deepseek-coder:33b** | 33B | 16K | ⭐⭐⭐⭐ (~73%) | ⭐⭐⭐⭐ (~76%) | ✅ | Open | 🥉 Classique |

### Notes sur les Benchmarks

- **HumanEval** : 164 problèmes Python (standard de l'industrie)
- **MBPP** : Mostly Basic Python Problems (suite de HumanEval)
- **Context Max** : Taille maximale de la fenêtre de contexte (🚀 = 160K+, 🔥 = 128K, standard = 16-32K)
- Les scores varient selon la taille du modèle et les configurations
- **deepseek-coder-v2:16b** a le plus grand contexte (160K) grâce à son architecture MoE

---

## 🎯 Recommandation Finale par Cas d'Usage

### 🏆 Pour Éditeur CLI Type Cursor (RECOMMANDÉ)

**Choix #1** : **devstral:24b**
- ✅ Spécialement conçu pour agents de coding
- ✅ Tool calling natif (format OpenAI)
- ✅ Performance optimale pour développement
- ✅ 24B paramètres (bon équilibre)

**Choix #2** : **deepseek-coder-v2:16b**
- ✅ Performance comparable GPT-4 Turbo
- ✅ Architecture MoE efficace
- ✅ Entraînement massif sur code

**Choix #3** : **qwen2.5-coder:14b** ou **32b**
- ✅ Bon équilibre taille/performance
- ✅ Tool calling supporté
- ✅ Polyvalent et fiable

---

## 🚀 Plan d'Action Recommandé

### Phase 1 : Test avec devstral (TOP CHOIX)

```bash
# 1. Télécharger devstral
ollama pull devstral:24b

# 2. Tester rapidement
ollama run devstral:24b "Write a Python function to sort a list"
```

### Phase 2 : Comparer avec deepseek-coder-v2

```bash
# Télécharger alternative
ollama pull deepseek-coder-v2:16b

# Comparer performances sur vos tâches réelles
```

### Phase 3 : Migration Code

Utiliser l'API compatible OpenAI d'Ollama :

```typescript
// Dans src/horus/client.ts
constructor(apiKey: string, model?: string, baseURL?: string) {
  this.client = new OpenAI({
    apiKey: apiKey || "ollama",
    baseURL: baseURL || "http://localhost:11434/v1",
    timeout: 360000,
  });
  // Modèle par défaut
  this.currentModel = model || "devstral:24b";
}
```

```typescript
// Dans src/utils/settings-manager.ts
const DEFAULT_USER_SETTINGS: Partial<UserSettings> = {
  baseURL: "http://localhost:11434/v1",
  defaultModel: "devstral:24b",
  models: [
    "devstral:24b",           // TOP CHOIX
    "deepseek-coder-v2:16b",   // Alternative MoE
    "qwen2.5-coder:14b",       // Option équilibrée
    "deepseek-coder:33b",       // Classique
  ],
};
```

---

## ⚡ Optimisations pour Coding

### Options Ollama pour Coding

```typescript
// Options recommandées pour génération de code
const options = {
  num_predict: -2,      // Fill context (essentiel!)
  temperature: 0.2,    // Plus déterministe pour code (vs 0.7 général)
  num_ctx: 32768,      // Long contexte pour gros fichiers
};
```

**Pourquoi température 0.2 ?**
- Le code nécessite précision, pas créativité
- Réduit les hallucinations
- Code plus cohérent et fonctionnel

---

## 📚 Ressources et Benchmarks

### Benchmarks Officiels

- **HumanEval** : https://github.com/openai/human-eval
- **MBPP** : https://github.com/google-research/google-research/tree/master/mbpp
- **CodeXGLUE** : https://github.com/microsoft/CodeXGLUE

### Modèles sur Ollama

- **devstral** : https://ollama.com/library/devstral
- **deepseek-coder-v2** : https://ollama.com/library/deepseek-coder-v2
- **qwen2.5-coder** : https://ollama.com/library/qwen2.5-coder
- **deepseek-coder** : https://ollama.com/library/deepseek-coder

## 🎉 Conclusion

**Pour un éditeur CLI de coding type Cursor IDE :**

🏆 **devstral:24b** est le choix optimal :
- Conçu spécifiquement pour agents de coding
- Performance maximale sur tâches de développement
- Tool calling natif OpenAI
- 24B paramètres (bon équilibre)

🥈 **deepseek-coder-v2:16b** comme alternative :
- Performance comparable GPT-4 Turbo
- Architecture MoE efficace
- Entraînement massif code

**Complexité Migration** : ⭐ (Très simple avec API compatible OpenAI)  
**Temps estimé** : 30-60 minutes  
**Performance attendue** : Équivalente ou supérieure à Grok Code pour tâches de coding

---

*Document généré le : {{ date }}*

