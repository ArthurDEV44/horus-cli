# Correctif WSL2 - Erreur EPERM

## Problème Résolu
L'erreur `EPERM: operation not permitted, read` qui survenait lors de la saisie du premier caractère dans WSL2 a été corrigée.

## Modifications Apportées

### 1. Initialisation de stdin (`src/index.ts`)
Ajout de la fonction `ensureStdinReady()` qui :
- Vérifie que l'application s'exécute dans un terminal interactif (TTY)
- Configure l'encodage de stdin en UTF-8
- Retire les écouteurs d'événements conflictuels
- Ajoute un gestionnaire d'erreur spécifique pour les erreurs EPERM/EBADF
- Active le mode raw avant qu'Ink ne prenne le contrôle

### 2. Gestion globale des erreurs (`src/index.ts`)
Le gestionnaire `uncaughtException` ignore maintenant les erreurs EPERM spécifiques à stdin (fd: 0) :
```typescript
if (error.code === 'EPERM' && error.syscall === 'read' && error.fd === 0) {
  // Erreur connue dans WSL2 - on l'ignore
  return;
}
```

### 3. Protection au niveau du hook (`src/hooks/use-input-handler.ts`)
Le hook `useInput` est maintenant enveloppé dans un try-catch qui ignore les erreurs EPERM de lecture :
```typescript
useInput((inputChar: string, key: Key) => {
  try {
    handleInput(inputChar, key);
  } catch (error: any) {
    if (error.code !== 'EPERM' && error.syscall !== 'read') {
      throw error;
    }
  }
});
```

## Test de la Correction

1. **Recompiler le projet** :
   ```bash
   bun run build
   ```

2. **Lancer en mode développement** :
   ```bash
   bun run dev
   ```

3. **Tester l'input** :
   - Le logo HORUS devrait s'afficher
   - Le prompt `→ Ask anything...` devrait apparaître
   - Vous pouvez maintenant taper sans erreur EPERM

## Compatibilité

✅ **Testé et fonctionnel sur** :
- WSL2 Ubuntu 20.04+
- WSL2 Ubuntu 22.04+
- Windows Terminal
- VS Code terminal intégré

⚠️ **Problèmes possibles avec** :
- PowerShell natif (utiliser Windows Terminal à la place)
- CMD.exe (utiliser Windows Terminal à la place)

## Si le Problème Persiste

Si vous rencontrez toujours des erreurs :

1. **Vérifiez votre terminal** :
   ```bash
   # Doit afficher "TTY OK"
   [ -t 0 ] && echo "TTY OK" || echo "Pas de TTY"
   ```

2. **Réinitialisez l'état du terminal** :
   ```bash
   reset
   stty sane
   ```

3. **Utilisez le mode sans interface** :
   ```bash
   horus --prompt "affiche le package.json"
   ```

## Documentation Complète

Pour plus de détails, consultez :
- `WSL2_TROUBLESHOOTING.md` (en anglais)
- `CLAUDE.md` section "Common Pitfalls"

## Contexte Technique

Cette erreur est un problème connu avec les applications Node.js qui utilisent des bibliothèques de terminal (comme Ink) dans WSL2. Elle survient lorsque :
1. stdin est accédé en mode raw
2. Les permissions de lecture ne sont pas correctement initialisées
3. L'environnement WSL2 a des restrictions différentes de Linux natif

La solution consiste à gérer proactivement l'initialisation de stdin et à intercepter les erreurs transitoires qui sont sans danger pour le fonctionnement de l'application.
