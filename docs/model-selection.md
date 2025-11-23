# Horus CLI - Model Selection Guide

> **Guide complet** : Sélection optimale des modèles Mistral/Ollama pour Horus CLI selon votre configuration matérielle

**Dernière mise à jour** : 2025-01-23 (Phase 5)
**Version** : 1.0

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Modèles disponibles](#modèles-disponibles)
3. [Matrice de sélection](#matrice-de-sélection)
4. [Configuration Ollama](#configuration-ollama)
5. [Utilisation](#utilisation)
6. [Trade-offs détaillés](#trade-offs-détaillés)
7. [FAQ](#faq)

---

## Vue d'ensemble

### Pourquoi la sélection de modèle est importante

Le **choix du modèle** est le facteur #1 de performance pour Horus CLI local :

- **Context window** : Plus grand = plus lent (scaling quadratique de l'attention)
- **Taille du modèle** : Plus gros = meilleure qualité, mais plus de VRAM et plus lent
- **VRAM disponible** : Limite physique contraignante pour les modèles locaux

### Recommandation par défaut

**🎯 mistral-small (22B, 32K context)** est le meilleur compromis pour la majorité des tâches :
- Excellente qualité de code
- Contexte suffisant pour la plupart des refactors
- VRAM raisonnable (12-16 GB)
- Vitesse acceptable (4/5)

---

## Modèles disponibles

Horus CLI supporte 4 modèles Mistral principaux :

| Modèle | Taille | Context | VRAM Min | VRAM Recommandé | Vitesse | Qualité |
|--------|--------|---------|----------|-----------------|---------|---------|
| **mistral** | 7B | 8K | 4 GB | 6 GB | ⚡⚡⚡⚡⚡ (5/5) | ⭐⭐⭐ (3/5) |
| **mistral-small** | 22B | 32K | 12 GB | 16 GB | ⚡⚡⚡⚡ (4/5) | ⭐⭐⭐⭐ (4/5) |
| **mixtral** | 8x7B MoE | 32K | 24 GB | 32 GB | ⚡⚡⚡ (3/5) | ⭐⭐⭐⭐⭐ (5/5) |
| **devstral:24b** | 24B | 128K | 32 GB | 40 GB | ⚡⚡ (2/5) | ⭐⭐⭐⭐ (4/5) |

### Caractéristiques détaillées

#### mistral (7B)
- **Use cases** : Navigation fichiers, petites éditions, réponses rapides
- **Avantages** : Très rapide (80-120 tokens/sec), faible VRAM
- **Limites** : Contexte limité (8K), qualité code moyenne
- **Quand utiliser** : Tâches simples, prototypage, machines limitées

#### mistral-small (22B) ⭐ **RECOMMANDÉ**
- **Use cases** : Refactors multi-fichiers, analyses approfondies, most tasks
- **Avantages** : Excellent compromis qualité/vitesse, contexte généreux (32K)
- **Limites** : VRAM significatif (12-16 GB)
- **Quand utiliser** : Tâche par défaut, 80% des cas d'usage

#### mixtral (8x7B MoE)
- **Use cases** : Refactors complexes, décisions d'architecture, subagents parallèles
- **Avantages** : Meilleure qualité (5/5), architecture MoE efficace
- **Limites** : VRAM élevé (24-32 GB), plus lent
- **Quand utiliser** : Tâches critiques nécessitant la meilleure qualité

#### devstral:24b (24B, 128K)
- **Use cases** : Longs contextes, sessions multi-heures, deep debugging
- **Avantages** : Contexte énorme (128K), excellente compréhension
- **Limites** : Très lent, VRAM très élevé (32-40 GB)
- **Quand utiliser** : Analyse de gros projets, sessions longues

---

## Matrice de sélection

### Sélection automatique par VRAM

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
│  latence  │  latence    │  latence    │   latence           │
│           │             │             │                     │
│  Use:     │  Use:       │  Use:       │   Use:              │
│  - Fast   │  - Most     │  - Complex  │   - Long sessions   │
│    nav    │    tasks    │    refactor │   - Deep analysis   │
│  - Small  │  - Medium   │  - Parallel │   - Multi-hour      │
│    edits  │    refactor │    subagent │     debugging       │
│           │             │                                   │
└───────────┴─────────────┴─────────────┴─────────────────────┘
```

### Sélection par contexte requis

| Contexte requis | VRAM < 8GB | VRAM 8-16GB | VRAM 16-32GB | VRAM 32GB+ |
|-----------------|------------|-------------|--------------|------------|
| **< 8K tokens** | mistral | mistral-small | mistral-small | mistral-small |
| **8-16K tokens** | mistral | mistral-small | mistral-small | mistral-small |
| **16-32K tokens** | ❌ Error | mistral-small | mixtral | mixtral |
| **> 32K tokens** | ❌ Error | ❌ Error | ❌ Error | devstral:24b |

---

## Configuration Ollama

### Installation des modèles

```bash
# Installer tous les modèles Mistral
ollama pull mistral
ollama pull mistral-small
ollama pull mixtral
ollama pull devstral:24b
```

### Créer des Modelfiles custom

**1. Mistral (fast profile)**

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

**2. Mistral-small (balanced profile)** ⭐

```bash
# ~/.ollama/models/horus-mistral-small.modelfile
FROM mistral-small

PARAMETER num_ctx 32768
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

**3. Mixtral (powerful profile)**

```bash
# ~/.ollama/models/horus-mixtral.modelfile
FROM mixtral

PARAMETER num_ctx 32768
PARAMETER temperature 0.2
PARAMETER top_p 0.9

SYSTEM """
You are Horus, a local AI coding assistant. You help developers by:
- Reading and analyzing code files
- Making precise edits using tools
- Explaining complex architectures
- Refactoring code for clarity

You excel at complex refactoring and architectural decisions.
"""
```

**4. Devstral (deep profile)**

```bash
# ~/.ollama/models/horus-devstral.modelfile
FROM devstral:24b

PARAMETER num_ctx 128000
PARAMETER temperature 0.2
PARAMETER top_p 0.9

SYSTEM """
You are Horus, a local AI coding assistant. You help developers by:
- Reading and analyzing code files
- Making precise edits using tools
- Explaining complex architectures
- Refactoring code for clarity

You have access to very large context windows for deep analysis.
"""
```

### Build custom models

```bash
ollama create horus-mistral -f ~/.ollama/models/horus-mistral.modelfile
ollama create horus-mistral-small -f ~/.ollama/models/horus-mistral-small.modelfile
ollama create horus-mixtral -f ~/.ollama/models/horus-mixtral.modelfile
ollama create horus-devstral -f ~/.ollama/models/horus-devstral.modelfile
```

### Configuration Horus CLI

```json
// .horus/settings.json
{
  "currentModel": "mistral-small",
  "models": {
    "mistral": {
      "maxContext": 8192,
      "provider": "ollama"
    },
    "mistral-small": {
      "maxContext": 32768,
      "provider": "ollama"
    },
    "mixtral": {
      "maxContext": 32768,
      "provider": "ollama"
    },
    "devstral:24b": {
      "maxContext": 128000,
      "provider": "ollama"
    }
  },
  "contextSettings": {
    "autoSelectModel": true,
    "reservedContextPercent": 0.3,
    "cacheEnabled": true
  }
}
```

---

## Utilisation

### Commande de benchmark

```bash
# Voir les recommandations pour votre système
horus context bench

# Tester un profil spécifique
horus context bench --profile balanced

# Output JSON
horus context bench --json
```

**Exemple de sortie** :

```
🏋️  System Benchmark & Model Recommendation

Detecting system configuration...
System Configuration:
  Platform: linux
  CPU Cores: 16
  RAM: 15.4 GB
  GPU Type: nvidia
  GPU Name: NVIDIA GeForce RTX 3090
  VRAM: 24 GB

Model Recommendations by Context Size:

Small Context (4K tokens):
  Model: mistral (fast)
  Reason: Small context, optimized for speed

Medium Context (16K tokens):
  Model: mistral-small (balanced)
  Reason: Small-medium context, optimal balance

Large Context (28K tokens):
  Model: mixtral (powerful)
  Reason: Medium-large context with high quality requirements

💡 Recommendations:

  ✓ Your system can run mixtral (8x7B) for complex tasks
  ✓ Recommended: Use mixtral for refactoring, mistral-small for most tasks
```

### Lancer Horus avec un modèle spécifique

```bash
# Default (auto-sélectionne mistral-small)
horus

# Fast profile (mistral 7B)
horus --model mistral

# Balanced profile (mistral-small 22B) [RECOMMANDÉ]
horus --model mistral-small

# Powerful profile (mixtral 8x7B)
horus --model mixtral

# Deep profile (devstral 128K)
horus --model devstral:24b
```

### Variables d'environnement

```bash
# Forcer un modèle spécifique
export HORUS_MODEL=mistral-small

# Enable auto-selection (recommandé)
export HORUS_AUTO_SELECT_MODEL=true

# Debug model selection
export HORUS_CONTEXT_DEBUG=true
```

---

## Trade-offs détaillés

### Comparaison chiffrée

| Critère | mistral | mistral-small | mixtral | devstral |
|---------|---------|---------------|---------|----------|
| **Tokens/sec** | 80-120 | 40-60 | 20-30 | 10-15 |
| **Qualité code** | 7/10 | 9/10 | 9.5/10 | 9/10 |
| **Compréhension** | 7/10 | 9/10 | 10/10 | 9.5/10 |
| **Following instructions** | 8/10 | 9/10 | 9/10 | 8.5/10 |
| **Coût compute (CPU)** | LOW | MEDIUM | HIGH | HIGH |
| **Coût VRAM** | 5GB | 14GB | 28GB | 40GB |
| **Context window** | 8K | 32K | 32K | 128K |
| **Vitesse totale** | ~1-2s | ~3-5s | ~8-12s | ~15-30s |

### Quand utiliser chaque modèle

#### mistral (7B) - Fast Profile
✅ **Utilisez quand** :
- Navigation rapide dans le code
- Petites éditions (1-2 fichiers)
- Réponses immédiates requises
- VRAM < 8GB

❌ **N'utilisez PAS quand** :
- Refactoring multi-fichiers
- Architecture complexe
- Contexte > 8K tokens requis

#### mistral-small (22B) - Balanced Profile ⭐
✅ **Utilisez quand** :
- Most tasks (80% des cas)
- Refactors multi-fichiers (jusqu'à 10-15 fichiers)
- Analyses approfondies
- VRAM 12-16GB disponible

❌ **N'utilisez PAS quand** :
- VRAM < 12GB
- Contexte > 32K requis
- Vitesse critique (préférer mistral)

#### mixtral (8x7B) - Powerful Profile
✅ **Utilisez quand** :
- Refactors complexes (architecture-wide)
- Décisions d'architecture
- Subagents parallèles (max 3)
- Qualité maximale requise
- VRAM 24-32GB disponible

❌ **N'utilisez PAS quand** :
- VRAM < 24GB
- Vitesse critique
- Tâches simples (overkill)

#### devstral:24b (24B, 128K) - Deep Profile
✅ **Utilisez quand** :
- Contexte > 32K requis
- Sessions multi-heures
- Deep debugging (analyser gros projets)
- VRAM 32GB+ disponible

❌ **N'utilisez PAS quand** :
- VRAM < 32GB
- Vitesse importante
- Contexte < 32K (overkill)

---

## FAQ

### Q1: Quel modèle choisir par défaut ?

**R**: **mistral-small (22B)** est le meilleur défaut pour 80% des cas. Il offre un excellent compromis qualité/vitesse.

### Q2: Mon système a seulement 8GB de RAM, quel modèle ?

**R**: Utilisez **mistral (7B)**. C'est le seul qui fonctionnera correctement avec 8GB de RAM totale (environ 4-6GB VRAM disponible).

### Q3: Comment améliorer la vitesse ?

**R**: 3 leviers principaux :
1. **Réduire le contexte** : Shorter context = faster (scaling quadratique)
2. **Modèle plus petit** : mistral (7B) est 3-5x plus rapide que mixtral
3. **GPU upgrade** : Plus de VRAM permet des modèles plus efficaces

### Q4: Puis-je changer de modèle en cours de session ?

**R**: Non, le modèle est fixé au démarrage. Utilisez `/exit` puis relancez Horus avec `--model <name>`.

### Q5: Comment savoir si j'ai assez de VRAM ?

**R**: Utilisez `horus context bench` pour voir les recommandations pour votre système.

### Q6: Mistral-small vs mixtral : quelle différence ?

**R**:
- **mistral-small** : 22B params, plus rapide (4/5), excellente qualité (4/5)
- **mixtral** : 8x7B MoE (56B params), plus lent (3/5), meilleure qualité (5/5)

Choisissez **mistral-small** par défaut, **mixtral** pour tâches critiques.

### Q7: Le contexte de 128K de devstral est-il vraiment utilisable ?

**R**: Oui, mais très lent (~30s par réponse). Utilisez seulement si vous avez vraiment besoin de 32K+ tokens de contexte (rare).

### Q8: Puis-je utiliser d'autres modèles que Mistral ?

**R**: Horus supporte tous les modèles Ollama compatibles OpenAI API. Ajoutez-les dans `model-configs.ts` pour la sélection automatique.

### Q9: Comment optimiser pour mon GPU spécifique ?

**R**: Ajustez `num_ctx` dans le Modelfile :
- GPU < 8GB : `num_ctx 4096`
- GPU 8-16GB : `num_ctx 8192`
- GPU 16-32GB : `num_ctx 32768`
- GPU 32GB+ : `num_ctx 128000`

### Q10: Quel est le coût en électricité ?

**R**: Approximations (basées sur RTX 3090, 350W TDP) :
- **mistral** : ~50W pendant génération (~0.05 kWh/h)
- **mistral-small** : ~150W pendant génération (~0.15 kWh/h)
- **mixtral** : ~280W pendant génération (~0.28 kWh/h)
- **devstral** : ~320W pendant génération (~0.32 kWh/h)

---

## Ressources supplémentaires

### Documentation
- [ROADMAP.md Phase 5](../ROADMAP.md#phase-5--tuning-modèles--benchmarks)
- [CLAUDE.md - Model Selection](../CLAUDE.md#phase-5-tuning-modèles--benchmarks)
- [Ollama Model Library](https://ollama.com/library)

### Benchmarks
- [Mistral AI Benchmarks](https://mistral.ai/news/mistral-small/)
- [DeepSeek Coder Benchmarks](https://github.com/deepseek-ai/DeepSeek-Coder)
- [MODELE_CODING_BENCHMARKS.md](../MODELE_CODING_BENCHMARKS.md)

### Communauté
- [GitHub Issues](https://github.com/ArthurDEV44/horus-cli/issues)
- [Discussions](https://github.com/ArthurDEV44/horus-cli/discussions)

---

**Dernière révision** : 2025-01-23 - Phase 5 complétée
**Maintenu par** : Équipe Horus CLI
**License** : MIT
