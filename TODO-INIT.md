# TODO : Commande `/init` - Version Simplifiée

> **Objectif** : Générer un fichier `HORUS.md` concis (~30 lignes) pour guider les assistants IA.

**État** : Phase 1 terminée (infrastructure)
**Date de création** : 2025-11-24
**Dernière mise à jour** : 2025-12-31

---

## Vue d'ensemble simplifiée

| Phase | Description | État |
|-------|-------------|------|
| **Phase 1** | Infrastructure (types, CLI) | ✅ Terminé |
| **Phase 2** | Scanner (package.json, tsconfig, git) | 🔴 À faire |
| **Phase 3** | Generator (template ~30 lignes) | 🔴 À faire |
| **Phase 4** | Tests & Documentation | 🔴 À faire |

**Estimation totale** : 6-8 heures (réduit de 20-28h)

---

## Phase 1 : Infrastructure ✅

**Commit** : `bfbdf4d`

- [x] Structure `src/init/`
- [x] Types de base (`types.ts`)
- [x] Commande CLI (`src/commands/init.ts`)
- [x] Intégration dans `src/index.ts`

---

## Phase 2 : Scanner (2-3h)

**Objectif** : Collecter les infos essentielles du projet

### Tâches

- [ ] **2.1** `scanPackageJson()` - Extraire name, scripts, deps clés
- [ ] **2.2** `scanTsConfig()` - Extraire module, target, strict
- [ ] **2.3** `scanGitMetadata()` - Branche, remote URL (optionnel)
- [ ] **2.4** `scanExistingHorusMd()` - Détecter si HORUS.md existe

### Fichiers à scanner

```
package.json     # scripts: dev, build, test, lint
tsconfig.json    # module, target, strict
.eslintrc*       # règles existantes (optionnel)
HORUS.md         # pour update mode
```

### Output attendu

```typescript
interface ScanResult {
  projectName: string;
  scripts: { dev?: string; build?: string; test?: string; lint?: string };
  hasTypeScript: boolean;
  isESM: boolean;
  existingHorusMd: string | null;
}
```

---

## Phase 3 : Generator (2-3h)

**Objectif** : Générer HORUS.md de ~30 lignes

### Tâches

- [ ] **3.1** Créer template simple (`templates/horus-template.ts`)
- [ ] **3.2** `generateHorusMd(scanResult)` - Remplir le template
- [ ] **3.3** `writeHorusMd(content, path)` - Écrire le fichier
- [ ] **3.4** Mode update : remplacer si existe (avec `--force`)

### Template cible

```markdown
# HORUS.md

## Build & Dev Commands

{commands}

## Code Style

{style_guidelines}

## Architecture

{architecture_summary}

## Key Patterns

{patterns}
```

### Détection automatique du style

```typescript
function detectCodeStyle(scanResult: ScanResult): string[] {
  const styles: string[] = [];

  if (scanResult.isESM) {
    styles.push('ESM imports with .js extension');
  }

  if (scanResult.hasTypeScript) {
    styles.push('Files: kebab-case.ts, Classes: PascalCase');
  }

  return styles;
}
```

---

## Phase 4 : Tests & Finalisation (1-2h)

### Tâches

- [ ] **4.1** Test unitaire scanner
- [ ] **4.2** Test unitaire generator
- [ ] **4.3** Test E2E : `horus init` sur projet test
- [ ] **4.4** Mettre à jour README.md

### Tests minimaux

```typescript
describe('horus init', () => {
  it('should generate HORUS.md', async () => {
    await runInit({ cwd: testProjectPath });
    expect(fs.existsSync(path.join(testProjectPath, 'HORUS.md'))).toBe(true);
  });

  it('should include build commands', async () => {
    const content = fs.readFileSync('HORUS.md', 'utf-8');
    expect(content).toContain('## Build & Dev Commands');
  });
});
```

---

## Ce qui a été supprimé (over-engineering)

Les éléments suivants de l'ancienne roadmap ont été **supprimés** :

- ❌ Detector de frameworks (trop complexe)
- ❌ Detector d'architecture (MVC, Clean, etc.)
- ❌ SnippetBuilder (compression de code)
- ❌ Diagrammes ASCII auto-générés
- ❌ Updater avec fusion intelligente de sections
- ❌ Multi-templates (minimal, detailed, api-docs)
- ❌ Export HTML/PDF/JSON
- ❌ Cache de scan
- ❌ Mode interactif
- ❌ Support multi-langues
- ❌ Analytics/telemetry pour /init
- ❌ Marketplace de templates

---

## Comportement final attendu

```bash
# Première utilisation
$ horus init
🔍 Scanning codebase...
📝 Generating HORUS.md...
✅ Created HORUS.md (32 lines)

# Si HORUS.md existe
$ horus init
⚠️  HORUS.md already exists. Use --force to overwrite.

$ horus init --force
🔍 Scanning codebase...
📝 Regenerating HORUS.md...
✅ Updated HORUS.md (32 lines)
```

---

## Exemple de sortie pour Horus CLI

```markdown
# HORUS.md

## Build & Dev Commands

pnpm install           # Install dependencies
bun run dev            # Dev mode with hot reload
bun run build          # Build TypeScript to dist/
bun test               # Run all tests
bun test tests/cache   # Run single test file

## Code Style

- ESM imports with .js extension: `import { X } from "./module.js"`
- Files: kebab-case (context-orchestrator.ts)
- Classes: PascalCase (ContextOrchestrator)
- Use async/await over promise chains
- Tools return { success, output?, error? }

## Architecture

Agent-based CLI with gather-act-verify loop.
- Core: src/agent/horus-agent.ts
- Tools: src/tools/ (6 tools: bash, editor, search, etc.)
- UI: src/ui/ (React/Ink components)

## Key Patterns

- Singletons: getSettingsManager(), getContextCache()
- Feature flags: HORUS_CONTEXT_MODE=off|mvp|full
- Tool interface: { name, description, execute(args) → ToolResult }
```

---

## Prochaine étape

Implémenter Phase 2 (Scanner) avec les 4 fonctions essentielles.

---

**Mainteneur** : Horus CLI Team
**Dernière mise à jour** : 2025-12-31
