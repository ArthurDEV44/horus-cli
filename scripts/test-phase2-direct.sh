#!/bin/bash
# Test Phase 2 - Direct execution with bun

echo "🧪 Testing Phase 2: SearchToolV2 (Direct with Bun)"
echo ""

# Build first
bun run build

# Run directly with bun
HORUS_CONTEXT_MODE=mvp \
HORUS_USE_SEARCH_V2=true \
HORUS_CONTEXT_DEBUG=true \
bun dist/index.js --prompt "Explique-moi comment SearchToolV2 fonctionne"
