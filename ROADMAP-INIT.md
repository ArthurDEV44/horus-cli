# ROADMAP : Commande `/init` - Version Simplifiée

> **Vision** : Générer un fichier HORUS.md concis (~30 lignes) pour guider Horus CLI.

**Date de création** : 2025-11-24
**Dernière mise à jour** : 2025-12-31
**Version cible** : 0.1.0

---

## Objectif

La commande `/init` génère un fichier `HORUS.md` qui :
- Contient les commandes essentielles (build, dev, test)
- Documente les conventions de code du projet
- Reste concis (~30 lignes) et actionnable
- Suit le principe "Progressive Disclosure"

---

## Phases

### Phase 1 : Infrastructure ✅ Terminée

- [x] Structure `src/init/`
- [x] Types TypeScript
- [x] Commande CLI de base
- [x] Intégration dans le CLI principal

### Phase 2 : Scanner 🔴 À faire

- [ ] `scanPackageJson()` - scripts, deps
- [ ] `scanTsConfig()` - module, target
- [ ] `scanGitMetadata()` - branche, remote
- [ ] `scanExistingHorusMd()` - détection

### Phase 3 : Generator 🔴 À faire

- [ ] Template simple (~30 lignes)
- [ ] `generateHorusMd(scanResult)`
- [ ] Mode `--force` pour overwrite

### Phase 4 : Finalisation 🔴 À faire

- [ ] Tests unitaires
- [ ] Test E2E
- [ ] Documentation README

---

## Ce qui a été supprimé

L'ancienne roadmap était trop ambitieuse. Éléments supprimés :

| Supprimé | Raison |
|----------|--------|
| Detector de frameworks | Over-engineering |
| Detector d'architecture | Over-engineering |
| Diagrammes ASCII auto | Over-engineering |
| Multi-templates | YAGNI |
| Export HTML/PDF | YAGNI |
| Fusion intelligente | Trop complexe |
| Cache de scan | Prématuré |
| Mode interactif | Prématuré |
| Multi-langues | Prématuré |
| Marketplace templates | Vision trop lointaine |

---

## Philosophie

### KISS (Keep It Simple)

```bash
$ horus init
✅ Created HORUS.md (32 lines)
```

### Progressive Disclosure

Au lieu de tout documenter, indiquer **où trouver** l'info :

```markdown
## Where to find info
- Architecture: src/agent/horus-agent.ts
- Tools: src/tools/*.ts
```

### ~20-30 lignes, pas 1500

Le HORUS.md doit être **scannable en 10 secondes**.

---

## Exemple de sortie

```markdown
# HORUS.md

## Build & Dev Commands

pnpm install           # Install deps
bun run dev            # Dev mode
bun run build          # Build
bun test               # Run tests

## Code Style

- ESM with .js extension
- Files: kebab-case, Classes: PascalCase
- async/await over promises

## Architecture

Agent-based: src/agent/ → src/tools/ → src/ui/

## Patterns

- Singletons: getSettingsManager()
- Flags: HORUS_CONTEXT_MODE=off|mvp|full
```

---

## Estimation

| Phase | Durée |
|-------|-------|
| Phase 2 (Scanner) | 2-3h |
| Phase 3 (Generator) | 2-3h |
| Phase 4 (Tests) | 1-2h |
| **Total** | **6-8h** |

Réduit de 20-28h grâce à la simplification.

---

## Références

- [Build your own /init command](https://kau.sh/blog/build-ai-init-command/)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Reverse engineering Claude Code](https://kirshatrov.com/posts/claude-code-internals)

---

**Dernière mise à jour** : 2025-12-31
