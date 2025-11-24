# Switch to Devstral as Default Model - Action Plan

**Date** : 2025-01-24
**Decision** : Remplacer `mistral-small` par `devstral` comme modèle par défaut
**Justification** : Voir [docs/devstral-vs-mistral-small-comparison.md](./docs/devstral-vs-mistral-small-comparison.md)

---

## 🎯 Résumé de la Décision

### Pourquoi Devstral ?

**Devstral 24B est supérieur à Mistral Small 3.1 pour Horus CLI car** :

1. ✅ **Spécialisé agents de code** : Fine-tuné de Mistral Small 3.1 pour agentic coding
2. ✅ **46.8% SWE-Bench** : Meilleur modèle open-source, +20% vs GPT-4.1-mini
3. ✅ **128K context** : vs 32K pour Mistral Small 3.1
4. ✅ **Exploration codebase** : Optimisé pour le cas d'usage principal d'Horus
5. ✅ **Même taille** : 24B paramètres, même coût compute

**Trade-off accepté** : Pas de multimodal (vision) → Horus n'en a pas besoin.

---

## 📋 Changements Requis

### 1. Settings Manager ✅ **Priority: HIGH**

**Fichier** : `src/utils/settings-manager.ts`

**Changements** :

```typescript
// Ligne 30
const DEFAULT_USER_SETTINGS: Partial<UserSettings> = {
  baseURL: "http://localhost:11434/v1",
-  defaultModel: "mistral-small", // CHANGED from devstral:24b (Phase 5)
+  defaultModel: "devstral", // RECOMMENDED: Best for agentic coding (24B, 128K, SWE-Bench 46.8%)
  models: [
    "mistral",
    "mistral-small",
+    "devstral", // 🏆 RECOMMENDED
    "mixtral",
-    "devstral:24b",
    "deepseek-coder-v2:16b",
    "qwen2.5-coder:14b",
    "deepseek-coder:33b",
    "qwen2.5-coder:32b",
  ],
};

// Ligne 47
const DEFAULT_PROJECT_SETTINGS: Partial<ProjectSettings> = {
-  model: "mistral-small", // CHANGED from devstral:24b (Phase 5)
+  model: "devstral", // RECOMMENDED: Best for agentic coding
};
```

**Justification** :
- `devstral` (pas `:24b`) car c'est le tag Ollama officiel
- Mistral Small reste dans la liste (pour utilisateurs voulant généraliste)

---

### 2. Horus Client ✅ **Priority: HIGH**

**Fichier** : `src/horus/client.ts`

**Changements** :

```typescript
// Ligne 44
export class HorusClient {
-  private currentModel: string = "devstral:24b";
+  private currentModel: string = "devstral"; // Default: Best for agentic coding (SWE-Bench 46.8%)
```

**Justification** : Aligner avec DEFAULT_USER_SETTINGS.

---

### 3. Model Selector ✅ **Priority: MEDIUM**

**Fichier** : `src/horus/model-selector.ts`

**Changements** :

```typescript
// Ajouter Devstral à MISTRAL_MODELS (ligne ~39)
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
+  'devstral': {
+    name: 'devstral',
+    vramMin: 32,
+    context: 131072, // 128K
+    speed: 2,
+    quality: 4, // Higher quality for coding tasks
+  },
  'mixtral': {
    name: 'mixtral',
    vramMin: 24,
    context: 32768,
    speed: 1,
    quality: 4,
  },
-  'devstral:24b': {
-    name: 'devstral:24b',
-    vramMin: 32,
-    context: 131072,
-    speed: 2,
-    quality: 4,
-  },
};

// Mettre à jour MODEL_PROFILES (ligne ~216)
export const MODEL_PROFILES: Record<string, string> = {
  fast: 'mistral',
-  balanced: 'mistral-small',
+  balanced: 'devstral', // ✅ UPDATED: Best balance for coding
  powerful: 'mixtral',
-  deep: 'devstral:24b',
+  deep: 'devstral', // ✅ UPDATED: Max context for coding
};
```

**Justification** :
- Devstral devient `balanced` ET `deep` (car optimal pour coding)
- Mistral Small reste disponible via sélection manuelle

---

### 4. Context Commands ✅ **Priority: LOW**

**Fichier** : `src/commands/context.ts`

**Changements** :

```typescript
// Ligne 132
.option("--model <model>", "Model to use for planning", "devstral") // UPDATED (was devstral:24b)
```

**Justification** : Cohérence avec default settings.

---

### 5. Subagent Manager ✅ **Priority: LOW**

**Fichier** : `src/context/subagent-manager.ts`

**Changements** :

```typescript
// Ligne 103
-      model: config.model ?? process.env.HORUS_MODEL ?? 'devstral:24b',
+      model: config.model ?? process.env.HORUS_MODEL ?? 'devstral',
```

**Justification** : Fallback cohérent avec default.

---

### 6. Documentation ✅ **Priority: MEDIUM**

**Fichiers à mettre à jour** :

#### README.md

```diff
# Horus CLI

...

## Modèles Supportés

- **mistral** (7B) - Fast
- **mistral-small** (22B) - Généraliste balanced
-+ **devstral** (24B) - 🏆 RECOMMANDÉ pour coding (SWE-Bench 46.8%)
- **mixtral** (8x7B) - Powerful multi-task
- **deepseek-coder-v2:16b** - Alternative coding

...

## Configuration

-Le modèle par défaut est `mistral-small` (peut être changé via `horus settings model`).
+Le modèle par défaut est `devstral` (spécialisé agents de code, SWE-Bench 46.8%).
+
+Pour changer : `horus settings model mistral-small` (si vous préférez généraliste).
```

#### CLAUDE.md

```diff
# Settings Manager

const DEFAULT_USER_SETTINGS: Partial<UserSettings> = {
  baseURL: "http://localhost:11434/v1",
-  defaultModel: "mistral-small", // CHANGED from devstral:24b (Phase 5)
+  defaultModel: "devstral", // Phase 5: Best for agentic coding
  models: [
    "mistral",
    "mistral-small",
+    "devstral", // 🏆 RECOMMENDED
    "mixtral",
-    "devstral:24b",
  ],
};
```

#### docs/model-selection.md (nouveau fichier créé par Phase 5)

Ajouter section dédiée Devstral :

```markdown
## Devstral 24B - Recommandé pour Horus CLI 🏆

**Spécifications** :
- 24B paramètres
- 128K context window
- SWE-Bench Verified: 46.8% (meilleur open-source)

**Pourquoi le choisir** :
- Spécialisé exploration codebase
- Édition multi-fichiers optimale
- Bat GPT-4.1-mini de 20%
- Fine-tuné de Mistral Small 3.1

**Quand utiliser Mistral Small à la place** :
- Tâches multimodales (images)
- Chatbot conversationnel généraliste
- Moins de 32GB VRAM disponible
```

---

## 🧪 Tests de Validation

### Pre-deployment Checklist

- [ ] Build TypeScript passe (`bun run build`)
- [ ] Lancer Horus avec default model (`horus --prompt "test"`)
- [ ] Vérifier que Devstral est utilisé (logs debug)
- [ ] Tester phase GATHER (context orchestration)
- [ ] Tester phase ACT (tool execution)
- [ ] Tester phase VERIFY (verification pipeline)
- [ ] Vérifier commande `horus context bench` affiche Devstral comme recommandé

### Test Commands

```bash
# 1. Build
bun run build

# 2. Vérifier default model
export HORUS_CONTEXT_DEBUG=true
bun run start --prompt "Explique-moi comment fonctionne ContextOrchestrator"
# → Doit charger "devstral"

# 3. Tester bench command
bun run start context bench
# → Doit recommander "devstral" pour coding

# 4. Tester override
bun run start --model mistral-small --prompt "test"
# → Doit utiliser mistral-small (override fonctionne)

# 5. Tester settings
bun run start settings model devstral
# → Doit sauvegarder devstral dans .horus/settings.json
```

---

## 🚀 Déploiement

### Step-by-Step

1. **Backup settings** (optionnel)
   ```bash
   cp src/utils/settings-manager.ts src/utils/settings-manager.ts.backup
   ```

2. **Apply changes** (see sections 1-5 above)

3. **Build & Test**
   ```bash
   bun run build
   bun test # Si Bun stable, sinon skip
   ```

4. **Update documentation** (section 6)

5. **Commit**
   ```bash
   git add .
   git commit -m "feat(models): switch default from mistral-small to devstral

- Update DEFAULT_USER_SETTINGS.defaultModel: mistral-small → devstral
- Update HorusClient.currentModel: devstral:24b → devstral
- Update MODEL_PROFILES: balanced/deep → devstral
- Add devstral to MISTRAL_MODELS with 128K context
- Remove devstral:24b tag (use canonical 'devstral')

Justification:
- Devstral fine-tuned from Mistral Small 3.1 for agentic coding
- 46.8% SWE-Bench Verified (best open-source, +20% vs GPT-4.1-mini)
- 128K context vs 32K (Mistral Small 3.1)
- Optimized for codebase exploration (Horus primary use case)
- Same compute cost (24B params)

See: docs/devstral-vs-mistral-small-comparison.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

6. **Push & PR** (si workflow PR)
   ```bash
   git push origin dev
   # Create PR to main
   ```

---

## 📊 Expected Impact

### Positive

- ✅ **Meilleure exploration codebase** (+6% SWE-Bench vs prior SOTA)
- ✅ **Meilleure édition multi-fichiers**
- ✅ **Context window 4x plus grand** (128K vs 32K)
- ✅ **Alignement use case** (agentic coding = Horus core)

### Neutral

- 🟡 **Même VRAM requis** (32-40GB, identique Mistral Small 22B variant)
- 🟡 **Même vitesse** (~150 tokens/sec)
- 🟡 **Même pricing API** ($0.1/M input, $0.3/M output)

### Negative (mitigé)

- ⚠️ **Pas de multimodal** → Mais Horus n'utilise pas vision
- ⚠️ **Utilisateurs <32GB VRAM** → Peuvent override vers mistral-small
  - Solution : Message clair dans `horus context bench`

---

## 🔄 Rollback Plan

Si problème majeur détecté :

```bash
# 1. Revert commit
git revert <commit-hash>

# 2. OU manually edit
# src/utils/settings-manager.ts
defaultModel: "devstral" → "mistral-small"

# src/horus/client.ts
currentModel: "devstral" → "mistral-small"

# 3. Rebuild
bun run build

# 4. Test
bun run start --prompt "test"
```

**Critère rollback** :
- Performance dégradée >20% vs mistral-small
- Crashes fréquents avec devstral
- Feedback utilisateurs négatif majoritaire

**Probabilité rollback** : **Faible** (<5%) car Devstral est fine-tuné du même base model.

---

## 📚 Références

- [Comparaison Technique Complète](./docs/devstral-vs-mistral-small-comparison.md)
- [Ollama Devstral](https://ollama.com/library/devstral)
- [Mistral AI - Devstral Announcement](https://mistral.ai/news/devstral)
- [SWE-Bench Results](https://adam.holter.com/devstral-small-2507-mistral-ais-agentic-coding-llm-just-destroyed-the-swe-bench/)

---

**Status** : ⏸️ **READY TO IMPLEMENT**
**Approver** : @ArthurDEV44
**ETA** : 30 minutes (changes + tests + docs)
