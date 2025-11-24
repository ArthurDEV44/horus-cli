# ROADMAP : Commande `/init` - Documentation Automatique pour IA

> **Vision** : Permettre à Horus CLI de s'auto-documenter intelligemment pour faciliter l'intégration avec tous les assistants IA (Claude, GPT, Gemini, etc.)

**Date de création** : 2025-11-24
**Version cible** : 0.1.0 (feature `/init`)
**État global** : 🔴 Planification

---

## 🎯 Vision et Objectifs

### Problème Actuel

Actuellement, chaque assistant IA (Claude Code, Cursor, GitHub Copilot) utilise son propre format de documentation de codebase :
- Claude Code → `CLAUDE.md`
- Cursor → `.cursor/rules/`
- GitHub Copilot → `.github/copilot-instructions.md`
- Gemini → `GEMINI.md`

**Problématiques** :
1. **Duplication** : Maintenance de multiples fichiers similaires
2. **Incohérence** : Documentation divergente entre assistants
3. **Obsolescence** : Difficile de maintenir à jour manuellement
4. **Coût cognitif** : Le développeur doit connaître chaque format

### Solution : Commande `/init` Universelle

La commande `/init` de Horus CLI va :
1. **Scanner automatiquement** le codebase
2. **Détecter intelligemment** la stack technique et l'architecture
3. **Générer un fichier HORUS.md** complet et structuré
4. **Mettre à jour intelligemment** le fichier existant (préservation du contenu custom)
5. **S'adapter** au format préféré de chaque assistant (optionnel)

### Objectifs Stratégiques

#### Court terme (v0.1.0)
- ✅ Génération automatique de `HORUS.md`
- ✅ Mise à jour intelligente avec préservation
- ✅ Détection de stack et architecture
- ✅ Intégration CLI native

#### Moyen terme (v0.2.0)
- 🔄 Support multi-formats (CLAUDE.md, GEMINI.md, etc.)
- 🔄 Templates personnalisables
- 🔄 Export HTML/PDF
- 🔄 Analyse sémantique avancée (relations entre modules)

#### Long terme (v1.0.0)
- 🚀 Documentation vivante (auto-update sur git commit hook)
- 🚀 Intégration CI/CD (validation de documentation)
- 🚀 API de documentation en temps réel
- 🚀 Marketplace de templates communautaires

---

## 📊 Architecture Stratégique

### Principe KISS (Keep It Simple, Stupid)

La commande `/init` doit être **simple à utiliser** mais **puissante sous le capot**.

```
User Experience:
$ horus init
🔍 Scanning codebase...
🧠 Detecting patterns...
📝 Generating documentation...
✅ Created HORUS.md (245 lines, 8 sections)
```

### Architecture Modulaire

```
┌─────────────────────────────────────────────────┐
│              CLI Command (init.ts)              │
│         User-facing interface + options         │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│        InitOrchestrator (orchestrator.ts)       │
│      Coordinates: scan → detect → generate      │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼─────┐ ┌──▼────────┐ ┌▼──────────┐
│  Scanner    │ │ Detector  │ │ Generator │
│  (scan.ts)  │ │(detect.ts)│ │ (gen.ts)  │
└─────────────┘ └───────────┘ └───────────┘
        │           │           │
        └───────────┼───────────┘
                    │
        ┌───────────▼───────────┐
        │   Updater (update.ts) │
        │  Smart merge & preserve│
        └───────────────────────┘
```

### Principes de Conception

1. **Scan rapide** : <3s sur projet moyen (utiliser fast-glob, pas de LLM)
2. **Détection heuristique** : patterns simples, pas d'IA (fiabilité)
3. **Génération par templates** : pas de génération LLM (coût, latence)
4. **Mise à jour intelligente** : préserver le contenu humain (diff-based)
5. **Zero-config** : fonctionne out-of-the-box, options pour power users

---

## 🗺️ Roadmap par Version

### Version 0.1.0 - MVP (Foundation) 🎯

**Date cible** : +3 semaines
**Effort estimé** : 20-28 heures
**Statut** : 🔴 Planifié

#### Fonctionnalités Core

- [x] **Infrastructure**
  - [x] Structure modulaire (`src/init/`)
  - [x] Types TypeScript complets
  - [x] Commande CLI de base

- [ ] **Scanner**
  - [ ] Scan `package.json` (deps, scripts, metadata)
  - [ ] Scan `tsconfig.json` / ESLint config
  - [ ] Scan structure de dossiers (max 3 niveaux)
  - [ ] Scan metadata Git (commits, branche, repo URL)
  - [ ] Stats codebase (fichiers, lignes, langages)

- [ ] **Detector**
  - [ ] Détection frameworks (React, Express, Ink, etc.)
  - [ ] Détection architecture (MVC, Clean, Agent-based)
  - [ ] Détection conventions (naming, imports, ESM/CJS)
  - [ ] Détection test framework (Jest, Vitest, Bun)

- [ ] **Generator**
  - [ ] Template HORUS.md complet (10 sections)
  - [ ] Génération Tech Stack table
  - [ ] Génération arborescence de dossiers
  - [ ] Génération diagramme architecture ASCII
  - [ ] Génération Quick Start (scripts)

- [ ] **Updater**
  - [ ] Parsing HORUS.md existant
  - [ ] Extraction sections `<!-- PRESERVE -->`
  - [ ] Fusion intelligente (replace/merge/preserve)
  - [ ] Écriture avec backup (`.bak`)

- [ ] **Tests & Documentation**
  - [ ] Tests unitaires (>80% coverage)
  - [ ] Tests d'intégration (génération + update)
  - [ ] Documentation dans CLAUDE.md
  - [ ] Mise à jour README.md

#### Limitations Acceptables v0.1.0

- ❌ Pas de multi-formats (uniquement HORUS.md)
- ❌ Pas de templates custom
- ❌ Pas d'export HTML/PDF
- ❌ Pas de cache de scan
- ❌ Pas de mode interactif avancé

#### Critères de Succès v0.1.0

- ✅ `horus init` génère un HORUS.md valide
- ✅ Détection correcte de la stack Horus CLI (TypeScript, Ink, Bun, Agent-based)
- ✅ Mise à jour préserve les sections custom
- ✅ Temps d'exécution <5s sur Horus CLI (~15k lignes)
- ✅ Documentation complète et claire

---

### Version 0.2.0 - Enhanced (Polish) 🚀

**Date cible** : +6 semaines
**Effort estimé** : 15-20 heures
**Statut** : 🟡 Planifié

#### Fonctionnalités Avancées

- [ ] **Multi-formats**
  - [ ] Génération CLAUDE.md (format Anthropic)
  - [ ] Génération .cursor/rules/ (format Cursor)
  - [ ] Génération .github/copilot-instructions.md
  - [ ] Option `--format <claude|cursor|copilot|all>`

- [ ] **Templates Custom**
  - [ ] Support templates dans `.horus/templates/`
  - [ ] Templates prédéfinis : `minimal`, `detailed`, `api-docs`
  - [ ] Option `--template <name>`
  - [ ] Commande `horus init templates` pour lister

- [ ] **Cache & Performance**
  - [ ] Cache de scan dans `.horus/.init-cache.json`
  - [ ] Hash-based invalidation
  - [ ] Option `--no-cache`
  - [ ] Scan parallélisé (Promise.all)

- [ ] **Export Formats**
  - [ ] Export HTML (markdown-it → HTML)
  - [ ] Export PDF (via pandoc si disponible)
  - [ ] Export JSON structuré
  - [ ] Option `--export <html|pdf|json>`

- [ ] **Mode Interactif**
  - [ ] Prompt de confirmation si fichier existe
  - [ ] Sélection interactive de sections à générer
  - [ ] Preview diff avant update
  - [ ] Option `--interactive`

- [ ] **Analyse Avancée**
  - [ ] Détection de relations entre modules (imports graph)
  - [ ] Détection de points d'entrée (main, index, cli)
  - [ ] Détection de patterns de design (Singleton, Factory, etc.)

#### Critères de Succès v0.2.0

- ✅ Génération multi-formats fonctionnelle
- ✅ Templates custom utilisables
- ✅ Cache améliore performance >50%
- ✅ Export HTML/PDF sans erreur
- ✅ Mode interactif intuitif

---

### Version 0.3.0 - Smart (Intelligence) 🧠

**Date cible** : +10 semaines
**Effort estimé** : 20-25 heures
**Statut** : 🔵 Vision

#### Fonctionnalités Intelligentes

- [ ] **Analyse Sémantique**
  - [ ] Parsing AST (TypeScript Compiler API)
  - [ ] Extraction de JSDoc / TSDoc
  - [ ] Détection de types exportés
  - [ ] Génération de documentation API

- [ ] **Détection de Changements**
  - [ ] Diff détaillé entre versions
  - [ ] Notification de breaking changes
  - [ ] Suggestion de migration
  - [ ] Changelog automatique

- [ ] **Intégration Git**
  - [ ] Git hook pre-commit (validation doc)
  - [ ] Git hook post-commit (auto-update)
  - [ ] Commande `horus init --watch` (file watcher)

- [ ] **Recommandations**
  - [ ] Suggestions d'amélioration architecture
  - [ ] Détection de code smell
  - [ ] Suggestions de patterns

#### Critères de Succès v0.3.0

- ✅ Documentation API auto-générée
- ✅ Git hooks fonctionnels
- ✅ Recommandations pertinentes
- ✅ Mode watch stable

---

### Version 1.0.0 - Universal (Ecosystem) 🌍

**Date cible** : +16 semaines
**Effort estimé** : 30-40 heures
**Statut** : 🔵 Vision

#### Fonctionnalités Ecosystème

- [ ] **Documentation Vivante**
  - [ ] API serveur de documentation
  - [ ] WebSocket pour updates temps réel
  - [ ] Dashboard web (React)
  - [ ] Commande `horus init serve`

- [ ] **CI/CD Integration**
  - [ ] GitHub Action pour validation
  - [ ] GitLab CI template
  - [ ] Plugin pour CI populaires
  - [ ] Badge de freshness documentation

- [ ] **Marketplace de Templates**
  - [ ] Registry de templates communautaires
  - [ ] Commande `horus init install <template>`
  - [ ] Rating et reviews
  - [ ] Templates pour frameworks populaires

- [ ] **Multi-langues**
  - [ ] Détection langue du README
  - [ ] Génération multilingue (FR, EN, ES, etc.)
  - [ ] Traduction automatique (optionnel)

- [ ] **Intégrations IA**
  - [ ] Plugin Claude Code natif
  - [ ] Plugin Cursor natif
  - [ ] Plugin GitHub Copilot natif
  - [ ] API pour autres assistants

#### Critères de Succès v1.0.0

- ✅ Dashboard web fonctionnel
- ✅ 10+ templates communautaires
- ✅ CI/CD intégration testée sur 3 plateformes
- ✅ Support 3+ langues
- ✅ Adoption par 100+ projets

---

## 🔬 Recherche & Innovation

### Pistes d'Innovation

#### 1. Documentation Contextuelle (R&D)
**Concept** : Générer documentation adaptée au contexte de l'assistant IA

Exemples :
- Claude Code demande architecture → focus diagrammes
- Cursor demande conventions → focus style guide
- Copilot demande API → focus signatures de fonctions

**Technologie** : Analyse du contexte de la requête (prompt engineering)

#### 2. Apprentissage du Style (R&D)
**Concept** : Apprendre le style de documentation préféré du projet

- Analyser les fichiers MD existants
- Détecter ton (formel, casual), structure, niveau de détail
- Adapter le template généré au style détecté

**Technologie** : NLP léger (sentiment analysis, readability scores)

#### 3. Documentation as Code (R&D)
**Concept** : Documentation versionnée et testable

- Types TypeScript pour documenter APIs
- Tests de documentation (exemples exécutables)
- Validation automatique (doc = code)

**Technologie** : TypeDoc, DocTest-like system

---

## 📈 Métriques de Succès

### KPIs Techniques

| Métrique | v0.1.0 | v0.2.0 | v1.0.0 |
|----------|--------|--------|--------|
| **Temps de scan** (15k LOC) | <5s | <3s | <2s |
| **Couverture tests** | >80% | >85% | >90% |
| **Formats supportés** | 1 | 4 | 6+ |
| **Templates disponibles** | 1 | 3 | 10+ |
| **Langues supportées** | 1 | 1 | 3+ |

### KPIs Utilisateurs

| Métrique | v0.1.0 | v0.2.0 | v1.0.0 |
|----------|--------|--------|--------|
| **Projets utilisant `/init`** | 10+ | 50+ | 100+ |
| **Issues documentation** | <5 | <3 | <2 |
| **Satisfaction utilisateur** | 4/5 | 4.5/5 | 4.8/5 |
| **Temps de setup doc** | -80% | -90% | -95% |

### Objectifs Qualitatifs

- ✅ Documentation toujours à jour (auto-update)
- ✅ Adoption naturelle par nouveaux projets
- ✅ Référence pour autres CLI tools
- ✅ Contribution communautaire active

---

## 🎨 Design Principles

### 1. Simplicité avant Tout
- Commande unique : `horus init`
- Zero configuration par défaut
- Options progressives (--verbose, --format, etc.)

### 2. Intelligence sans Magie
- Pas de boîte noire LLM (coût, latence, imprévisibilité)
- Heuristiques simples et transparentes
- Logs verbeux pour comprendre les décisions

### 3. Respect du Contenu Humain
- Préservation stricte des sections custom
- Fusion intelligente, jamais écrasement aveugle
- Backup automatique avant update

### 4. Performance d'Abord
- Scan rapide (pas de read inutiles)
- Cache intelligent
- Parallélisation quand possible

### 5. Extensibilité Native
- Architecture modulaire
- Templates personnalisables
- Plugins pour détection custom

---

## 🤝 Contribution & Communauté

### Open Source First

Le module `/init` sera **open-source** dès la v0.1.0 :
- License MIT
- Contributions welcomes
- Issues & PR encouragés

### Roadmap Communautaire

Après v0.1.0, la roadmap sera **co-construite** avec la communauté :
- Votes sur les features prioritaires
- RFCs pour features majeures
- Beta testing sur projets réels

### Templates Communautaires

Objectif : marketplace de templates pour différents types de projets :
- Microservices
- Fullstack (Next.js, Remix, etc.)
- CLI Tools
- Libraries / Frameworks
- Mobile (React Native, Flutter)

---

## 🚧 Risques et Mitigation

### Risques Techniques

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Performance sur gros projets** | Haut | Moyen | Cache, scan parallèle, exclusions |
| **Faux positifs de détection** | Moyen | Haut | Tests sur projets variés, logs verbeux |
| **Formatage Markdown cassé** | Moyen | Faible | Validation markdown, tests d'intégration |
| **Conflits de fusion** | Haut | Moyen | Backup automatique, mode dry-run |

### Risques Produit

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Faible adoption** | Haut | Moyen | Documentation claire, exemples, promotion |
| **Maintenance templates** | Moyen | Haut | Templates communautaires, automatisation |
| **Feature creep** | Moyen | Haut | Roadmap stricte, MVP d'abord |

---

## 📚 Références et Inspirations

### Outils Similaires

1. **Claude Code `/init`**
   - Source d'inspiration principale
   - Génération de CLAUDE.md
   - [Build your own /init command](https://kau.sh/blog/build-ai-init-command/)

2. **TypeDoc**
   - Documentation API TypeScript
   - AST parsing
   - [typedoc.org](https://typedoc.org)

3. **Backstage TechDocs**
   - Documentation as Code
   - CI/CD integration
   - [backstage.io/docs/features/techdocs](https://backstage.io/docs/features/techdocs/)

4. **Readme.so / readme.ai**
   - Génération automatique de README
   - Templates
   - [readme.so](https://readme.so)

### Articles et Ressources

- [Cooking with Claude Code: The Complete Guide](https://www.siddharthbharath.com/claude-code-the-complete-guide/)
- [Step-by-Step Guide: Prepare Your Codebase for Claude Code](https://medium.com/@dan.avila7/step-by-step-guide-prepare-your-codebase-for-claude-code-3e14262566e9)
- [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [awesome-claude-code GitHub](https://github.com/hesreallyhim/awesome-claude-code)
- [Reverse engineering Claude Code](https://kirshatrov.com/posts/claude-code-internals)

---

## 🎯 Next Steps (Immediate)

### Sprint 1 (Semaine 1-2) : Infrastructure
- [ ] Créer structure modulaire
- [ ] Implémenter scanner de base
- [ ] Tests unitaires scanner

### Sprint 2 (Semaine 2-3) : Detection & Generation
- [ ] Implémenter detector
- [ ] Implémenter generator
- [ ] Template HORUS.md de base

### Sprint 3 (Semaine 3-4) : Update & Polish
- [ ] Implémenter updater
- [ ] Orchestrator final
- [ ] Tests d'intégration

### Sprint 4 (Semaine 4-5) : Documentation & Release
- [ ] Documentation complète
- [ ] Mise à jour CLAUDE.md
- [ ] Release v0.1.0 beta

---

## 📞 Contact & Feedback

Pour toute question ou suggestion sur la roadmap `/init` :

- **GitHub Issues** : [horus-cli/issues](https://github.com/ArthurDEV44/horus-cli/issues)
- **Discussions** : Tag `[init]` dans les discussions
- **Pull Requests** : Welcomes pour améliorations roadmap

---

**Dernière mise à jour** : 2025-11-24
**Version du document** : 1.0
**Mainteneur** : Claude Code + Horus CLI Team
**License** : MIT
