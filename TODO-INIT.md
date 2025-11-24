# TODO : Implémentation de la commande `/init`

> **Objectif** : Implémenter une commande `/init` qui génère/met à jour automatiquement un fichier `HORUS.md` documentant le codebase pour les assistants IA.

**Estimation totale** : 20-28 heures
**État** : 🔴 Non commencé
**Date de création** : 2025-11-24

---

## 📊 Vue d'ensemble des phases

| Phase | Tâches | Durée | État |
|-------|--------|-------|------|
| **Phase 1** | Infrastructure de base | 2-3h | 🔴 À faire |
| **Phase 2** | Scanner | 3-4h | 🔴 À faire |
| **Phase 3** | Detector | 2-3h | 🔴 À faire |
| **Phase 4** | Generator | 4-5h | 🔴 À faire |
| **Phase 5** | Updater | 3-4h | 🔴 À faire |
| **Phase 6** | Orchestrator & CLI | 2h | 🔴 À faire |
| **Phase 7** | Tests & Documentation | 2-3h | 🔴 À faire |
| **Phase 8** | Optimisations & Polish | 1-2h | 🔴 À faire |

**Légende** : 🔴 À faire • 🟡 En cours • 🟢 Terminé

---

## Phase 1 : Infrastructure de Base (2-3h)

**Objectif** : Créer la structure de base du module `init`

### Tâches

- [ ] **1.1** Créer le dossier `src/init/`
- [ ] **1.2** Créer `src/init/types.ts` avec toutes les interfaces
  ```typescript
  // InitConfig, ScanResult, DetectionResult, GenerationContext, etc.
  ```
- [ ] **1.3** Créer `src/init/scanner.ts` (fonctions vides avec signatures)
  ```typescript
  export async function scanPackageJson(): Promise<PackageMetadata> { /* TODO */ }
  export async function scanTsConfig(): Promise<TsConfigMetadata | null> { /* TODO */ }
  export async function scanGitMetadata(): Promise<GitMetadata> { /* TODO */ }
  export async function scanDirectoryStructure(): Promise<DirectoryStructure> { /* TODO */ }
  export async function scanCodebaseStats(): Promise<CodebaseMetadata> { /* TODO */ }
  ```
- [ ] **1.4** Créer `src/init/detector.ts` (fonctions vides avec signatures)
  ```typescript
  export function detectFrameworks(scan: ScanResult): string[] { /* TODO */ }
  export function detectArchitecture(scan: ScanResult): string | null { /* TODO */ }
  export function detectConventions(scan: ScanResult): ProjectConventions { /* TODO */ }
  export function detectTestFramework(scan: ScanResult): string | null { /* TODO */ }
  ```
- [ ] **1.5** Créer `src/init/generator.ts` (fonctions vides)
  ```typescript
  export function generateFromTemplate(ctx: GenerationContext): string { /* TODO */ }
  export function generateTechStackTable(ctx: GenerationContext): string { /* TODO */ }
  export function generateDirectoryTree(structure: DirectoryStructure): string { /* TODO */ }
  export function generateArchitectureDiagram(arch: string): string { /* TODO */ }
  export function generateQuickStart(pkg: PackageMetadata): string { /* TODO */ }
  ```
- [ ] **1.6** Créer `src/init/updater.ts` (fonctions vides)
  ```typescript
  export function parseExistingFile(path: string): Promise<ParsedHorusFile> { /* TODO */ }
  export function extractPreserveSections(parsed: ParsedHorusFile): Map<string, string> { /* TODO */ }
  export function mergeContent(old: ParsedHorusFile, new: string): string { /* TODO */ }
  export function writeUpdatedFile(path: string, content: string): Promise<void> { /* TODO */ }
  ```
- [ ] **1.7** Créer `src/init/index.ts` pour exporter les modules
- [ ] **1.8** Créer `src/commands/init.ts` avec commande CLI de base
  ```typescript
  export function createInitCommand(): Command {
    const initCmd = new Command("init");
    initCmd
      .description("Generate or update HORUS.md documentation")
      .option("-f, --force", "Force full regeneration")
      .option("--no-preserve", "Don't preserve custom sections")
      .option("-o, --output <file>", "Output file", "HORUS.md")
      .option("-v, --verbose", "Verbose output")
      .action(async (options) => {
        console.log("🚧 Init command not yet implemented");
      });
    return initCmd;
  }
  ```
- [ ] **1.9** Intégrer dans `src/index.ts`
  ```typescript
  import { createInitCommand } from "./commands/init.js";
  program.addCommand(createInitCommand());
  ```
- [ ] **1.10** Test de smoke : vérifier que `horus init --help` fonctionne

**Résultat attendu** : Structure de base créée, commande CLI fonctionnelle (sans implémentation)

---

## Phase 2 : Scanner (3-4h)

**Objectif** : Implémenter toutes les fonctions de scan du codebase

### Tâches

- [ ] **2.1** Implémenter `scanPackageJson()`
  - Lire et parser `package.json`
  - Extraire : name, version, description, main, scripts, dependencies, devDependencies, engines, type
  - Gérer l'absence de `package.json` (erreur ou valeurs par défaut)
  - **Test** : Tester sur Horus CLI lui-même

- [ ] **2.2** Implémenter `scanTsConfig()`
  - Lire et parser `tsconfig.json` si présent
  - Extraire : module, target, strict, paths, outDir
  - Retourner `null` si pas de tsconfig
  - **Test** : Tester sur Horus CLI

- [ ] **2.3** Implémenter `scanGitMetadata()`
  - Exécuter `git remote get-url origin` pour l'URL du repo
  - Exécuter `git rev-parse --abbrev-ref HEAD` pour la branche
  - Exécuter `git log --pretty=format:"%H|%an|%ae|%ad|%s" --date=short -20` pour historique
  - Parser les commits
  - Gérer l'absence de git (warning, pas d'erreur)
  - **Test** : Tester sur Horus CLI

- [ ] **2.4** Implémenter `scanDirectoryStructure()`
  - Utiliser `fast-glob` ou `tree-node-cli`
  - Générer arborescence avec max 3 niveaux de profondeur
  - Exclure : `node_modules`, `.git`, `dist`, `build`, `.horus`
  - Retourner structure en texte ASCII
  - **Test** : Vérifier format de sortie

- [ ] **2.5** Implémenter `scanCodebaseStats()`
  - Scanner tous les fichiers avec `fast-glob`
  - Compter par extension : `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rs`, etc.
  - Compter lignes de code (estimation via `wc -l` ou lecture manuelle)
  - Détecter langage principal (celui avec le plus de fichiers)
  - **Test** : Vérifier stats sur Horus CLI (~15k lignes)

- [ ] **2.6** Implémenter `scanExistingDocs()`
  - Scanner : `README.md`, `CLAUDE.md`, `GEMINI.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`
  - Scanner : `.cursor/rules/**`, `.github/copilot-instructions.md`
  - Extraire sections pertinentes (features, architecture)
  - **Test** : Vérifier extraction sur Horus CLI

- [ ] **2.7** Tests unitaires pour toutes les fonctions de scan
  - Créer un projet test minimal
  - Tester chaque fonction individuellement
  - Mock les commandes git si nécessaire

**Résultat attendu** : Toutes les fonctions de scan implémentées et testées

---

## Phase 3 : Detector (2-3h)

**Objectif** : Implémenter la détection automatique de stack et patterns

### Tâches

- [ ] **3.1** Implémenter `detectFrameworks()`
  - Détecter frontend : React, Next.js, Vue, Svelte, Angular
  - Détecter backend : Express, Fastify, NestJS, Koa
  - Détecter CLI : Commander, Yargs, Ink, Oclif
  - Détecter test : Jest, Vitest, Bun Test, Mocha
  - Détecter build : Webpack, Vite, Rollup, esbuild, Turbopack
  - Utiliser `hasDependency()` helper
  - **Test** : Vérifier détection sur Horus CLI (Commander, Ink, Bun, React)

- [ ] **3.2** Implémenter `detectArchitecture()`
  - Détecter MVC : présence de `models/`, `views/`, `controllers/`
  - Détecter Clean Architecture : `domain/`, `application/`, `infrastructure/`
  - Détecter Hexagonal : `domain/`, `adapters/`, `ports/`
  - Détecter Agent-based : `agent/`, `tools/`, `context/` (Horus spécifique)
  - Détecter Microservices : `services/**` + multiple `package.json`
  - Détecter Monorepo : `pnpm-workspace.yaml`, `lerna.json`, `nx.json`
  - **Test** : Vérifier détection "Agent-based" sur Horus CLI

- [ ] **3.3** Implémenter `detectConventions()`
  - Analyser noms de fichiers : détecter kebab-case, camelCase, PascalCase
  - Analyser imports : détecter extensions `.js`, `.ts` ou absentes
  - Détecter ESM vs CommonJS (depuis tsconfig.json + package.json type)
  - Détecter strict mode TypeScript
  - **Test** : Vérifier détection sur Horus CLI (kebab-case, .js extensions, ESM)

- [ ] **3.4** Implémenter `detectTestFramework()`
  - Détecter Jest : `jest` dans deps ou `jest.config.*`
  - Détecter Vitest : `vitest` dans deps
  - Détecter Bun : `bunfig.toml` ou script `bun test`
  - Détecter Mocha : `mocha` dans deps
  - **Test** : Vérifier détection "Bun Test" sur Horus CLI

- [ ] **3.5** Implémenter `detectBuildTool()`
  - Détecter depuis package.json scripts : `build`, `compile`, `bundle`
  - Identifier l'outil : tsc, webpack, vite, rollup, etc.
  - **Test** : Vérifier détection "tsc" sur Horus CLI

- [ ] **3.6** Tests unitaires pour toutes les fonctions de détection
  - Mock les résultats de scan
  - Tester chaque pattern de détection

**Résultat attendu** : Détection automatique fonctionnelle pour tous les patterns majeurs

---

## Phase 4 : Generator (4-5h)

**Objectif** : Implémenter la génération du fichier HORUS.md

### Tâches

- [ ] **4.1** Créer `src/init/templates/base-template.ts`
  - Template Markdown complet avec placeholders
  - Sections : Overview, Quick Start, Architecture, Structure, Workflows, Conventions, Testing, Common Tasks, Troubleshooting, Resources
  - Placeholders : `[PROJECT_NAME]`, `[VERSION]`, `[DESCRIPTION]`, `[TECH_STACK_TABLE]`, etc.

- [ ] **4.2** Implémenter `generateFromTemplate()`
  - Charger template de base
  - Remplacer tous les placeholders avec les données du contexte
  - Insérer les sections générées
  - Retourner le Markdown complet
  - **Test** : Générer sur projet test minimal

- [ ] **4.3** Implémenter `generateTechStackTable()`
  - Formater en tableau Markdown :
    ```markdown
    | Component | Technology | Version |
    |-----------|-----------|---------|
    | **Language** | TypeScript | ^5.0.0 |
    ```
  - Inclure : Language, Runtime, Framework, Build, Test, UI (si applicable)
  - **Test** : Vérifier formatage

- [ ] **4.4** Implémenter `generateDirectoryTree()`
  - Convertir `DirectoryStructure` en code block Markdown
  - Formater avec indentation ASCII :
    ```
    src/
    ├── agent/
    │   ├── horus-agent.ts
    │   └── index.ts
    ├── tools/
    └── ...
    ```
  - **Test** : Vérifier sortie sur structure Horus CLI

- [ ] **4.5** Implémenter `generateArchitectureDiagram()`
  - Créer diagrammes ASCII art selon architecture :
    - Agent-based → Diagramme avec Agent, Tools, Context
    - MVC → Diagramme avec Models, Views, Controllers
    - Clean → Diagramme avec Domain, Application, Infrastructure
  - **Test** : Vérifier diagramme Agent-based pour Horus

- [ ] **4.6** Implémenter `generateQuickStart()`
  - Extraire scripts depuis `package.json`
  - Générer section avec commandes :
    ```bash
    # Install
    npm install

    # Build
    npm run build

    # Test
    bun test
    ```
  - **Test** : Vérifier extraction des scripts Horus CLI

- [ ] **4.7** Implémenter `generateConventionsSection()`
  - Générer exemples de code selon conventions détectées :
    - ESM → `import { X } from "./module.js"`
    - CommonJS → `const X = require('./module')`
    - Naming → `// Files: kebab-case`
  - **Test** : Vérifier exemples générés

- [ ] **4.8** Implémenter `generateTestingSection()`
  - Extraire framework de test détecté
  - Générer commandes de test
  - Lister fichiers de test trouvés
  - **Test** : Vérifier sur Horus CLI (90+ tests)

- [ ] **4.9** Tests d'intégration
  - Créer un projet test complet
  - Générer HORUS.md depuis zéro
  - Vérifier que toutes les sections sont présentes
  - Vérifier le formatage Markdown

**Résultat attendu** : Génération complète de HORUS.md fonctionnelle

---

## Phase 5 : Updater (3-4h)

**Objectif** : Implémenter la mise à jour intelligente du fichier existant

### Tâches

- [ ] **5.1** Implémenter `parseExistingFile()`
  - Lire le fichier HORUS.md existant
  - Parser en sections (split par `##`)
  - Extraire metadata (date, version)
  - Retourner `ParsedHorusFile`
  - **Test** : Parser le CLAUDE.md actuel comme exemple

- [ ] **5.2** Implémenter `extractPreserveSections()`
  - Détecter tags `<!-- PRESERVE:START -->` / `<!-- PRESERVE:END -->`
  - Extraire le contenu entre les tags
  - Stocker dans Map<sectionName, content>
  - **Test** : Créer fichier test avec sections PRESERVE

- [ ] **5.3** Implémenter stratégie de fusion
  - **Replace** : Tech Stack, Codebase Structure, Directory Layout
  - **Merge** : Key Features (ajouter nouveau, garder ancien)
  - **Preserve** : Common Tasks, Troubleshooting, Resources
  - Créer fonction `mergeSection(old, new, strategy)` pour chaque stratégie

- [ ] **5.4** Implémenter `mergeContent()`
  - Parcourir toutes les sections
  - Appliquer stratégie appropriée (replace/merge/preserve)
  - Réinsérer sections préservées
  - Maintenir l'ordre des sections
  - **Test** : Vérifier fusion correcte

- [ ] **5.5** Implémenter `writeUpdatedFile()`
  - Écrire le contenu fusionné
  - Créer backup du fichier original (`.bak`)
  - Gérer les erreurs d'écriture
  - **Test** : Vérifier écriture et backup

- [ ] **5.6** Implémenter détection de changements significatifs
  - Comparer nouvelle version vs ancienne
  - Détecter : nouvelles dépendances, changement d'architecture, nouveaux modules
  - Logger les changements détectés
  - **Test** : Simuler changements et vérifier détection

- [ ] **5.7** Tests d'intégration
  - Créer HORUS.md initial
  - Ajouter sections custom avec tags PRESERVE
  - Modifier le codebase (ajouter deps, changer structure)
  - Exécuter update
  - Vérifier que :
    - Sections PRESERVE intactes
    - Sections dynamiques mises à jour
    - Sections fusionnées correctement

**Résultat attendu** : Mise à jour intelligente fonctionnelle avec préservation du contenu custom

---

## Phase 6 : Orchestrator & CLI (2h)

**Objectif** : Coordonner toutes les phases et améliorer l'UX CLI

### Tâches

- [ ] **6.1** Créer `src/init/orchestrator.ts`
  ```typescript
  export class InitOrchestrator {
    constructor(config: InitConfig) { /* ... */ }

    async execute(): Promise<InitResult> {
      // 1. Scan codebase
      const scan = await this.scan();

      // 2. Detect patterns
      const detection = await this.detect(scan);

      // 3. Check if HORUS.md exists
      const exists = fs.existsSync(this.config.targetFile);

      // 4. Generate or update
      if (!exists || this.config.forceRegenerate) {
        return await this.generate(scan, detection);
      } else {
        return await this.update(scan, detection);
      }
    }
  }
  ```

- [ ] **6.2** Implémenter méthodes de l'orchestrateur
  - `scan()` : appeler toutes les fonctions de scanner
  - `detect()` : appeler toutes les fonctions de detector
  - `generate()` : générer nouveau fichier
  - `update()` : mettre à jour fichier existant

- [ ] **6.3** Améliorer CLI output dans `commands/init.ts`
  - Ajouter spinners pendant le scan (optionnel avec `ora`)
  - Afficher progression : "🔍 Scanning codebase...", "🧠 Detecting patterns...", "📝 Generating documentation..."
  - Afficher résumé final :
    ```
    ✅ Created HORUS.md
       245 lines written
       8 sections generated
    ```

- [ ] **6.4** Ajouter validations pre-flight
  - Vérifier que cwd est un projet valide (contient `package.json`)
  - Vérifier accès en écriture
  - Optionnel : vérifier que c'est un repo git

- [ ] **6.5** Ajouter mode `--dry-run` (preview)
  - Générer le contenu sans l'écrire
  - Afficher un diff si fichier existe
  - Afficher preview des premières lignes

- [ ] **6.6** Ajouter mode interactif (optionnel)
  - Si fichier existe et pas de `--force`, demander confirmation
  - Proposer : Overwrite / Update / Cancel

- [ ] **6.7** Tests end-to-end
  - Test création : `horus init` sur projet vierge
  - Test update : `horus init` sur projet avec HORUS.md existant
  - Test force : `horus init --force`
  - Test dry-run : `horus init --dry-run`

**Résultat attendu** : Commande CLI complète et utilisable

---

## Phase 7 : Tests & Documentation (2-3h)

**Objectif** : Tests complets et documentation

### Tâches

- [ ] **7.1** Créer suite de tests `tests/init/`
  - `tests/init/scanner.spec.ts`
  - `tests/init/detector.spec.ts`
  - `tests/init/generator.spec.ts`
  - `tests/init/updater.spec.ts`
  - `tests/init/orchestrator.spec.ts`

- [ ] **7.2** Implémenter tests unitaires
  - Scanner : tester chaque fonction avec fixtures
  - Detector : tester patterns de détection
  - Generator : tester génération de chaque section
  - Updater : tester fusion et préservation
  - Target : >80% de couverture

- [ ] **7.3** Créer projet de test fixture
  - `tests/fixtures/test-project/`
  - Minimal `package.json`, `tsconfig.json`, structure de dossiers
  - Utiliser dans tests d'intégration

- [ ] **7.4** Tests end-to-end complets
  - Test 1 : Génération initiale sur projet test
  - Test 2 : Mise à jour avec préservation
  - Test 3 : Mise à jour avec changements significatifs
  - Test 4 : Force regeneration
  - Vérifier format Markdown valide (optionnel : lint MD)

- [ ] **7.5** Documenter dans CLAUDE.md
  - Ajouter nouvelle section "Init Command System"
  - Expliquer architecture (scanner, detector, generator, updater)
  - Expliquer workflow de génération/mise à jour
  - Documenter stratégies de fusion
  - Ajouter exemples d'utilisation

- [ ] **7.6** Mettre à jour README.md
  - Ajouter section "Documentation Generation"
  - Exemple d'utilisation :
    ```bash
    # Generate initial documentation
    horus init

    # Update existing documentation
    horus init

    # Force regeneration
    horus init --force

    # Preview changes
    horus init --dry-run
    ```

- [ ] **7.7** Créer documentation utilisateur
  - `docs/init-command.md` avec guide complet
  - Expliquer tags `<!-- PRESERVE -->`
  - Expliquer sections dynamiques vs statiques
  - Best practices

**Résultat attendu** : Tests complets (>80% coverage) et documentation exhaustive

---

## Phase 8 : Optimisations & Polish (1-2h)

**Objectif** : Optimisations et fonctionnalités avancées (optionnelles)

### Tâches

- [ ] **8.1** Optimiser performance de scan
  - Utiliser `fast-glob` avec cache
  - Scanner en parallèle (Promise.all)
  - Éviter re-scan si rien n'a changé (hash de package.json)

- [ ] **8.2** Ajouter cache de résultats
  - Créer `.horus/.init-cache.json`
  - Stocker hash du codebase + résultat du scan
  - Invalider si package.json/tsconfig changent
  - Option `--no-cache` pour forcer re-scan

- [ ] **8.3** Améliorer détection de changements
  - Calculer diff entre ancienne et nouvelle version
  - Afficher résumé des changements :
    ```
    📊 Changes detected:
       + 3 new dependencies
       + 2 new directories
       ~ Architecture changed: MVC → Agent-based
    ```

- [ ] **8.4** Support multi-langues (optionnel)
  - Détecter langue du README (français, anglais)
  - Générer HORUS.md dans la même langue
  - Templates en français et anglais

- [ ] **8.5** Ajouter analytics/telemetry (optionnel)
  - Logger usage de `/init` dans telemetry
  - Métriques : durée de scan, taille du fichier généré, nombre de sections

- [ ] **8.6** Mode `--template <name>` (optionnel)
  - Permettre templates custom : `minimal`, `detailed`, `api-docs`
  - Stocker templates dans `.horus/templates/`

- [ ] **8.7** Export en formats additionnels (optionnel)
  - `--format html` : générer HTML depuis Markdown
  - `--format pdf` : générer PDF (via pandoc)
  - `--format json` : export structuré JSON

- [ ] **8.8** Tests de performance
  - Benchmarker sur gros projets (>100k lignes)
  - Vérifier temps d'exécution <5s sur projet moyen

**Résultat attendu** : Commande optimisée et fonctionnalités avancées

---

## 🎯 Critères de Succès

### Fonctionnels
- ✅ `horus init` génère un `HORUS.md` complet et valide
- ✅ `horus init` met à jour intelligemment un fichier existant
- ✅ Les sections custom avec `<!-- PRESERVE -->` sont préservées
- ✅ Détection automatique de stack et architecture fonctionnelle
- ✅ Génération de diagrammes ASCII art pertinents

### Techniques
- ✅ Code modulaire et testable
- ✅ Couverture de tests >80%
- ✅ Pas de régression sur CLI existant
- ✅ Documentation complète dans CLAUDE.md et README.md

### UX
- ✅ Commande rapide (<5s sur projet moyen)
- ✅ Output CLI clair et informatif
- ✅ Gestion d'erreurs gracieuse
- ✅ Messages d'aide et exemples clairs

---

## 📝 Notes de Développement

### Dépendances à ajouter
```json
{
  "dependencies": {
    "tree-node-cli": "^1.6.1",
    "markdown-it": "^13.0.2",
    "gray-matter": "^4.0.3",
    "fast-glob": "^3.3.2"
  },
  "devDependencies": {
    "ora": "^8.0.0" // optionnel pour spinners
  }
}
```

### Commandes git utiles
```bash
# Commits récents
git log --pretty=format:"%H|%an|%ae|%ad|%s" --date=short -20

# URL du repo
git remote get-url origin

# Branche courante
git rev-parse --abbrev-ref HEAD

# Fichiers les plus modifiés
git log --pretty=format:'' --name-only | sort | uniq -c | sort -rg | head -20
```

### Structure de fichiers recommandée
```
src/init/
├── index.ts                 # Exports
├── types.ts                 # Interfaces
├── orchestrator.ts          # Coordinateur principal
├── scanner.ts               # Scan du codebase
├── detector.ts              # Détection patterns
├── generator.ts             # Génération HORUS.md
├── updater.ts               # Mise à jour
├── helpers.ts               # Utilitaires
└── templates/
    ├── base-template.ts     # Template principal
    ├── sections/            # Templates par section
    │   ├── overview.ts
    │   ├── architecture.ts
    │   └── ...
    └── diagrams/            # Diagrammes ASCII
        ├── agent-based.ts
        ├── mvc.ts
        └── ...
```

---

## 🔄 Changelog

### 2025-11-24
- ✅ Création du fichier TODO-INIT.md
- 🔴 Phase 1-8 : À faire

---

**Dernière mise à jour** : 2025-11-24
**Mainteneur** : Claude Code + Horus CLI Team
