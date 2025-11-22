#!/bin/bash
# Test Phase 2 - SearchToolV2

echo "🧪 Testing Phase 2: SearchToolV2 + SnippetBuilder"
echo ""
echo "Variables d'environnement:"
echo "  HORUS_CONTEXT_MODE=mvp"
echo "  HORUS_USE_SEARCH_V2=true"
echo "  HORUS_CONTEXT_DEBUG=true"
echo ""

HORUS_CONTEXT_MODE=mvp \
HORUS_USE_SEARCH_V2=true \
HORUS_CONTEXT_DEBUG=true \
bun run start --prompt "Explique-moi comment SearchToolV2 utilise les 3 stratégies de scoring (modified, imports, fuzzy)"
