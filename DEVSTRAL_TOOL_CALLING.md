# Devstral Tool Calling: Analyse et Solution

## Problème identifié

Lors de l'utilisation de **Devstral:24b** avec Ollama, le modèle retourne les tool calls sous forme de JSON brut dans le champ `content` au lieu d'utiliser le format OpenAI standard `tool_calls`.

### Exemple de réponse incorrecte

```json
{
  "content": "[{\"name\": \"view_file\", \"arguments\": {\"path\": \"/path/to/file\"}}]",
  "tool_calls": null
}
```

### Réponse attendue (format OpenAI)

```json
{
  "content": null,
  "tool_calls": [{
    "id": "call_xyz",
    "type": "function",
    "function": {
      "name": "view_file",
      "arguments": "{\"path\": \"/path/to/file\"}"
    }
  }]
}
```

## Cause racine

D'après l'analyse de la documentation officielle et du Modelfile d'Ollama, Devstral utilise un **format propriétaire avec des tags spéciaux** :

### Template Devstral dans Ollama

Le template du modèle montre qu'il utilise les tags `[AVAILABLE_TOOLS]` et `[TOOL_CALLS]` :

```
{{- if and (eq $lastUserIndex $index) $.Tools }}[AVAILABLE_TOOLS]{{ $.Tools }}[/AVAILABLE_TOOLS]
{{- end }}[INST]{{ .Content }}[/INST]
{{- else if eq .Role \"assistant\" }}
{{- if .ToolCalls }}[TOOL_CALLS][
{{- range .ToolCalls }}{\"name\": \"{{ .Function.Name }}\", \"arguments\": {{ .Function.Arguments }}}
{{- end }}]\u003c/s\u003e
```

### Pourquoi Ollama ne convertit pas automatiquement ?

1. **Devstral est basé sur Mistral Small 3.1**, qui utilise le format raw mode de Mistral
2. **Ollama liste Devstral comme supportant les tools**, mais le template montre qu'il utilise un format différent du standard OpenAI
3. **L'API OpenAI-compatible d'Ollama** ne fait pas la conversion automatique pour ce format spécifique

### Modèles affectés

D'après la recherche, les modèles suivants peuvent être affectés :
- **devstral:24b** ✅ Confirmé - utilise raw mode
- **mistral:v0.3** - Utilise raw mode avec `[AVAILABLE_TOOLS]`/`[TOOL_CALLS]`
- Anciens modèles Mistral (non Nemo)

### Modèles fonctionnant correctement

Ces modèles supportent nativement le format OpenAI `tool_calls` :
- **Llama 3.1** ✅
- **Mistral Nemo** ✅
- **Firefunction v2** ✅
- **Command-R +** ✅
- **Qwen 2.5 Coder** ✅ (recommandé pour le coding)
- **DeepSeek Coder V2** ✅ (performance équivalente à GPT-4 Turbo)

## Solution implémentée

### Parser de secours (Fallback Parser)

Ajouté dans `src/agent/horus-agent.ts:422-474` :

```typescript
private parseRawToolCalls(content: string): HorusToolCall[] | null {
  if (!content || typeof content !== "string") {
    return null;
  }

  // Check if content looks like a JSON array of tool calls
  const trimmed = content.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    // Validate that it's an array of tool-like objects
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    // Check if all items have 'name' and 'arguments' properties
    const allValid = parsed.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.name === "string" &&
        item.arguments !== undefined
    );

    if (!allValid) {
      return null;
    }

    // Convert to HorusToolCall format
    return parsed.map((item, index) => ({
      id: `call_${Date.now()}_${index}`,
      type: "function" as const,
      function: {
        name: item.name,
        arguments:
          typeof item.arguments === "string"
            ? item.arguments
            : JSON.stringify(item.arguments),
      },
    }));
  } catch (error) {
    return null;
  }
}
```

### Détection pendant le streaming

Pour éviter d'afficher le JSON brut à l'utilisateur, nous détectons pendant le streaming si le contenu ressemble à des tool calls :

```typescript
// Stream content as it comes, but only if we haven't detected tool calls yet
if (chunk.choices[0].delta?.content) {
  accumulatedContent += chunk.choices[0].delta.content;

  // Only yield content if we haven't yielded tool calls yet
  if (!toolCallsYielded) {
    // Check if accumulated content looks like raw tool calls (raw mode format)
    const trimmed = accumulatedContent.trim();
    const looksLikeToolCalls =
      trimmed.startsWith("[") &&
      (trimmed.includes('"name":') || trimmed.includes('"arguments":'));

    // Only yield content if it doesn't look like tool calls
    if (!looksLikeToolCalls) {
      yield {
        type: "content",
        content: chunk.choices[0].delta.content,
      };
      contentYielded = true;
    }
  }
}
```

Cette détection précoce empêche l'affichage du JSON brut dans l'interface utilisateur.

### Intégration dans les deux modes

**Mode streaming** (`processUserMessageStream` - ligne 620-632):

```typescript
// Fallback: Check if content contains raw JSON tool calls
let finalToolCalls = accumulatedMessage.tool_calls;
let finalContent = accumulatedMessage.content;

if (!finalToolCalls && accumulatedMessage.content) {
  const parsedToolCalls = this.parseRawToolCalls(
    accumulatedMessage.content
  );
  if (parsedToolCalls) {
    finalToolCalls = parsedToolCalls;
    finalContent = ""; // Clear content since it was actually tool calls
  }
}
```

**Mode non-streaming** (`processUserMessage` - ligne 267-279) : même logique

## Avantages de cette solution

✅ **Rétrocompatibilité totale** : Fonctionne avec les modèles OpenAI standard ET les modèles raw mode
✅ **Transparent pour l'utilisateur** : Aucune configuration nécessaire
✅ **Validation stricte** : Ne parse que les vrais tool calls (évite les faux positifs)
✅ **Performance** : Ajout négligeable de latence (simple parse JSON)
✅ **Maintenable** : Logique isolée dans une méthode dédiée

## Alternatives possibles

### 1. Utiliser directement le format raw mode de Mistral

**Avantages** :
- Potentiellement plus fiable avec Devstral
- Format officiel de Mistral

**Inconvénients** :
- ❌ Nécessite une implémentation complètement différente
- ❌ Perd la compatibilité avec les modèles OpenAI standard
- ❌ Complexité accrue (deux chemins de code distincts)

### 2. Recommander un modèle différent

**Modèles recommandés pour Horus CLI** :

1. **Qwen 2.5 Coder** (128K context)
   - Support natif OpenAI tool_calls ✅
   - Excellent pour le coding
   - Disponible sur Ollama

2. **DeepSeek Coder V2** (160K context)
   - Performance comparable à GPT-4 Turbo
   - Support natif OpenAI tool_calls ✅
   - Architecture MoE efficiente

3. **Mistral Nemo**
   - Support natif OpenAI tool_calls ✅
   - Plus petit que Devstral (12B)
   - Officiellement supporté par Ollama pour les tools

### 3. Ne rien faire et documenter

❌ Non recommandé - mauvaise expérience utilisateur

## Recommandations

### Court terme (actuel)
✅ Garder le fallback parser pour compatibilité universelle

### Moyen terme
- Ajouter un avertissement dans l'UI quand Devstral est utilisé
- Suggérer automatiquement Qwen 2.5 Coder ou DeepSeek Coder V2

### Long terme
- Monitorer les updates d'Ollama : le support natif pourrait être ajouté
- Envisager un système de profils de modèles avec configuration auto

## Documentation de référence

### Sources Mistral AI
- [Devstral Announcement](https://mistral.ai/news/devstral) - Annonce officielle du modèle
- [Mistral Function Calling](https://docs.mistral.ai/capabilities/function_calling) - Documentation officielle

### Sources Ollama
- [Ollama Tool Support](https://ollama.com/blog/tool-support) - Blog officiel sur le support des tools
- [Devstral Model Card](https://ollama.com/library/devstral) - Page Ollama du modèle
- [OpenAI Compatibility Issue #6462](https://github.com/ollama/ollama/issues/6462) - Discussion GitHub sur la compatibilité

### Guides communautaires
- [Top Best Ollama Models 2025 for Function Calling](https://collabnix.com/best-ollama-models-for-function-calling-tools-complete-guide-2025/)
- [Function Calling with Ollama, Mistral 7B, Bash and Jq](https://k33g.hashnode.dev/function-calling-with-ollama-mistral-7b-bash-and-jq)
- [Mistral AI Cookbook - Ollama Function Calling](https://docs.mistral.ai/cookbooks/third_party-ollama-function_calling_local)

## Tests recommandés

Pour tester la solution :

```bash
# 1. Tester avec Devstral (raw mode)
horus --model devstral:24b --prompt "Peux-tu m'expliquer ce que fait Horus CLI"

# 2. Tester avec un modèle OpenAI standard
horus --model qwen2.5-coder:7b --prompt "Peux-tu m'expliquer ce que fait Horus CLI"

# 3. Tester avec DeepSeek Coder V2
horus --model deepseek-coder-v2:16b --prompt "Peux-tu m'expliquer ce que fait Horus CLI"
```

Les trois devraient maintenant fonctionner correctement.

## Conclusion

Le problème est maintenant résolu grâce au fallback parser qui détecte et convertit automatiquement les tool calls raw mode en format OpenAI standard. Cette solution offre une compatibilité universelle sans sacrifier les performances ni la simplicité d'utilisation.

Pour une expérience optimale, nous recommandons toutefois d'utiliser **Qwen 2.5 Coder** ou **DeepSeek Coder V2** qui supportent nativement le format OpenAI et offrent d'excellentes performances pour les tâches de coding.
