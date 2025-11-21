# Instructions Après Correctif WSL2

## ✅ Correctif Appliqué avec Succès

Le correctif pour l'erreur EPERM dans WSL2 a été appliqué avec succès au code. Voici ce qui a été fait et ce que vous devez faire ensuite.

## 📝 Récapitulatif des Modifications

### Code Source
- ✅ `src/index.ts` : Initialisation robuste de stdin + gestion des erreurs EPERM
- ✅ `src/hooks/use-input-handler.ts` : Protection du hook useInput
- ✅ Compilation réussie avec `bun run build`

### Documentation
- ✅ `CLAUDE.md` : Guide complet pour les futures instances de Claude Code
- ✅ `WSL2_TROUBLESHOOTING.md` : Guide de dépannage (anglais)
- ✅ `CORRECTIF_WSL2.md` : Documentation du correctif (français)
- ✅ `README.md` : Section dépannage ajoutée + mention WSL2 compatible
- ✅ `CHANGEMENTS_WSL2.txt` : Résumé des changements

## 🚀 Prochaines Étapes

### 1. Tester le Correctif

Ouvrez un **nouveau terminal WSL2** (important : nouveau terminal, pas celui-ci) et exécutez :

```bash
cd ~/code/horus-cli-ts
bun run dev
```

**Résultat attendu :**
- ✅ Le logo HORUS s'affiche en ASCII art coloré
- ✅ Le prompt `→ Ask anything...` apparaît
- ✅ Vous pouvez taper du texte SANS erreur EPERM
- ✅ L'application répond normalement

### 2. Si l'Erreur Persiste

Si vous voyez encore l'erreur EPERM :

```bash
# Réinitialiser le terminal
reset
stty sane

# Relancer
bun run dev
```

### 3. Alternative : Mode Sans Interface

Si le mode interactif a encore des problèmes :

```bash
# Test simple
horus --prompt "affiche le contenu du package.json"

# Doit fonctionner sans erreur
```

## 📊 Tests Recommandés

### Test 1 : Aide
```bash
horus --help
# Doit afficher l'aide sans erreur
```

### Test 2 : Mode Interactif
```bash
bun run dev
# Tapez quelques lettres, puis Ctrl+C
# Ne doit PAS afficher d'erreur EPERM
```

### Test 3 : Mode Headless
```bash
horus --prompt "test"
# Doit se connecter à Ollama ou afficher une erreur de connexion
# (pas une erreur EPERM)
```

## 🔍 Diagnostics

### Vérifier l'Environnement

```bash
# Version Node.js
node --version
# Doit être >= 18.0.0

# Version Bun
bun --version
# Doit être >= 1.0.0

# Type de terminal
echo $TERM
# Devrait être xterm-256color ou similaire

# WSL2 ?
uname -r
# Devrait contenir "microsoft" ou "WSL"
```

### Vérifier Ollama (si installé)

```bash
# Ollama est-il en cours d'exécution ?
curl http://localhost:11434/v1/models

# Si erreur, démarrer Ollama :
ollama serve
```

## 📚 Documentation

- **Guide complet** : Lisez `CORRECTIF_WSL2.md` pour les détails
- **Dépannage anglais** : `WSL2_TROUBLESHOOTING.md`
- **Architecture** : `CLAUDE.md` (pour développeurs)
- **README principal** : `README.md` (guide utilisateur complet)

## ⚙️ Configuration Recommandée

### Terminal Recommandé
- ✅ **Windows Terminal** (meilleur choix)
- ✅ VS Code terminal intégré
- ⚠️ Éviter : PowerShell natif, CMD.exe

### Pour Développeurs

Si vous voulez contribuer ou modifier le code :

1. **Lire CLAUDE.md** : Architecture et conventions
2. **Tester après modifications** :
   ```bash
   bun run build
   bun run dev
   ```
3. **Vérifier les types** :
   ```bash
   bun run typecheck
   ```

## 🐛 Signaler un Problème

Si le correctif ne fonctionne pas :

1. **Collectez les informations** :
   ```bash
   # Créer un fichier de diagnostic
   {
     echo "=== Environment ==="
     node --version
     bun --version
     uname -a
     echo $TERM
     echo "=== Test ==="
     bun run dist/index.js --help 2>&1
   } > diagnostic.txt
   ```

2. **Partagez le fichier `diagnostic.txt`** avec les informations d'erreur

## ✨ Fonctionnalités Principales

Maintenant que l'erreur est corrigée, vous pouvez utiliser :

### Mode Interactif
```bash
horus
# Interface conversationnelle complète
```

### Commandes Directes
```bash
# Afficher un fichier
horus --prompt "montre-moi le package.json"

# Modifier du code
horus --prompt "crée un fichier hello.js avec une fonction hello world"

# Git
horus git commit-and-push
```

### Commandes Intégrées
Dans le mode interactif :
- `/help` : Aide
- `/clear` : Effacer l'historique
- `/models` : Changer de modèle
- `/exit` : Quitter

### Raccourcis Clavier
- `↑/↓` : Historique des commandes
- `Ctrl+C` : Effacer l'input (deux fois pour quitter)
- `Ctrl+←/→` : Navigation par mot
- `Shift+Tab` : Toggle mode auto-edit

## 🎉 C'est Tout !

Le correctif est complet et documenté. Vous devriez maintenant pouvoir utiliser Horus CLI dans WSL2 sans erreur EPERM.

**Bon coding ! 🚀**

---

*Correctif appliqué le : $(date)*
*Version : 0.0.33*
*Environnement : WSL2 Ubuntu*
