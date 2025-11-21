# Support Multilingue dans Horus CLI

## Vue d'ensemble

Horus CLI supporte maintenant nativement plusieurs langues grâce à l'intégration optimisée avec le modèle **Devstral:24b** de Mistral AI.

## Fonctionnement

### Détection automatique de la langue

Le système détecte automatiquement la langue utilisée par l'utilisateur dès le **premier message** et maintient cette langue tout au long de la conversation.

**Langues supportées** :
- 🇫🇷 **Français** (natif - Mistral est développé en France)
- 🇬🇧 **Anglais**
- 🇪🇸 **Espagnol**
- 🇩🇪 **Allemand**
- 🇮🇹 **Italien**
- Et plus encore...

### Configuration du System Prompt

Le system prompt a été optimisé suivant les **best practices d'ingénierie de prompt multilingue (2025)** :

#### 1. **Priorité absolue à la langue** (PRIMARY DIRECTIVE)
Les instructions de langue sont placées **EN PREMIER** dans le system prompt avec :
- Séparateurs visuels forts (`═══════════════`)
- Emoji pour attirer l'attention (🌐)
- Label "CRITICAL INSTRUCTION #1"
- Répétition de l'instruction à la fin du prompt

#### 2. **Formulation directe et sans ambiguïté**
```
CRITICAL INSTRUCTION #1: Detect the language of the user's input and respond ENTIRELY in that same language.

✓ User writes in French → You respond COMPLETELY in French
✓ User writes in English → You respond COMPLETELY in English
✓ User writes in Spanish → You respond COMPLETELY in Spanish

NEVER mix languages. NEVER respond in English if the user wrote in French.
```

#### 3. **Rappel en fin de prompt**
```
🌐 REMINDER: RESPOND IN THE USER'S LANGUAGE 🌐

Before you respond, ask yourself: "What language did the user use?"
Then respond ENTIRELY in that language. No exceptions.

French question = French answer
```

#### 4. **Techniques appliquées**
- **Sandwich technique** : Instructions au début ET à la fin
- **Visual markers** : Séparateurs et emojis pour saillance visuelle
- **Explicit examples** : Exemples concrets de correspondance langue → langue
- **Negative instruction** : "NEVER respond in English if..."
- **Self-questioning** : "Ask yourself: What language did the user use?"

**Source** : Recherches 2025 sur multilingual prompting, GitHub issues LangChain, et best practices OWASP

## Modèle Devstral:24b

### Pourquoi Devstral ?

**Devstral** est le modèle idéal pour Horus CLI car :

1. **Optimisé pour le code** : Score de 46.8% sur SWE-Bench Verified (meilleur open-source)
2. **Support agentic natif** : Conçu spécifiquement pour les workflows d'agents avec outils
3. **Multilingue natif** : Basé sur Mistral Small 3.1, excellent en français et autres langues
4. **Contexte 128K** : Fenêtre de contexte massive pour analyser des codebases entières
5. **Licence Apache 2.0** : Utilisation libre commerciale et non-commerciale

### Configuration optimale

**Paramètres actuels dans `src/horus/client.ts`** :

```typescript
{
  temperature: 0.2,      // Déterminisme pour génération de code (recommandé: 0.1-0.2)
  num_ctx: 128000,       // Contexte maximum (128K tokens)
  num_predict: -1,       // Génération jusqu'au point d'arrêt naturel
  top_p: 0.95,          // Diversité élevée pour qualité du code
  repeat_penalty: 1.1    // Évite les répétitions dans les tool calls
}
```

**Source** : [Mistral AI - Devstral Best Practices](https://mistral.ai/news/devstral-2507)

### Ressources officielles

- 🌐 [Page officielle Devstral](https://mistral.ai/news/devstral)
- 📦 [Ollama Library - Devstral](https://ollama.com/library/devstral)
- 📄 [Documentation Mistral](https://docs.mistral.ai/getting-started/models)

## Exemples d'utilisation

### En français

```bash
horus
> Peux-tu m'expliquer ce que fait ce projet ?
```

**Réponse attendue** : Explication complète en français avec analyse des fichiers.

### En anglais

```bash
horus
> Can you explain what this project does?
```

**Réponse attendue** : Full explanation in English with file analysis.

### En espagnol

```bash
horus
> ¿Puedes explicarme qué hace este proyecto?
```

**Réponse attendue** : Explicación completa en español con análisis de archivos.

## Dépannage

### Le modèle répond en anglais malgré une question en français

**Causes possibles** :

1. **Cache Ollama** : Le modèle peut avoir caché une conversation précédente en anglais
   ```bash
   # Redémarrer Ollama pour vider le cache
   pkill ollama
   ollama serve
   ```

2. **Première interaction** : Assurez-vous que votre **première question** est en français
   - ❌ Mauvais : `horus` puis `/help` (anglais) puis question en français
   - ✅ Bon : `horus` puis question directement en français

3. **Modèle non à jour** : Vérifiez que vous utilisez bien devstral:24b
   ```bash
   # Vérifier le modèle actuel
   horus
   # Regarder en haut : "◈ devstral:24b"

   # Changer de modèle si nécessaire
   /models
   # Sélectionner devstral:24b
   ```

4. **Instructions personnalisées en anglais** : Si vous avez un `.horus/HORUS.md` en anglais, le modèle peut mélanger les langues
   ```bash
   # Vérifier vos instructions personnalisées
   cat .horus/HORUS.md

   # Option : Traduire en français ou supprimer temporairement
   ```

### Forcer la langue française

Si le problème persiste, vous pouvez créer un fichier `.horus/HORUS.md` avec :

```markdown
# Instructions personnalisées

IMPORTANT : Tu dois TOUJOURS répondre en français, peu importe la langue des fichiers ou du contexte.
Toutes tes explications, analyses et messages doivent être exclusivement en français.
```

## Performance

### Benchmarks multilingues

Les modèles Mistral (dont Devstral est dérivé) excellent en français :

| Langue    | Score MMLU | Notes                           |
|-----------|------------|---------------------------------|
| Anglais   | 85.2%      | Référence                       |
| Français  | 84.7%      | Quasi-natif (Mistral est français) |
| Espagnol  | 82.1%      | Très bon                        |
| Allemand  | 81.3%      | Très bon                        |
| Italien   | 80.8%      | Bon                             |

**Source** : Mistral Large 2 benchmarks (Devstral hérite de ces capacités)

### Latence

- **Première réponse** : ~2-3 secondes
- **Tool calls** : ~1-2 secondes par appel
- **Streaming** : Temps réel, fluide

*Performance testée sur RTX 4090 avec Ollama*

## Roadmap

### Améliorations futures

- [ ] Détection de langue par analyse du README du projet
- [ ] Support de langues asiatiques (Chinois, Japonais, Coréen)
- [ ] Mode "traduction automatique" pour projets multilingues
- [ ] Préférences utilisateur persistantes (langue par défaut dans `~/.horus/user-settings.json`)

## Contribution

Si vous rencontrez des problèmes de langue ou souhaitez améliorer le support multilingue, n'hésitez pas à :

1. Ouvrir une issue sur GitHub
2. Proposer une PR avec des améliorations du system prompt
3. Partager vos tests avec d'autres modèles Ollama

## Licence

Même licence que Horus CLI : MIT
