#!/bin/bash
# Script pour lancer Horus avec logs de debug capturés

export HORUS_CONTEXT_MODE=mvp
export HORUS_CONTEXT_DEBUG=true

# Capturer stderr dans un fichier tout en l'affichant
exec 2> >(tee -a horus-debug.log >&2)

echo "=== Horus CLI Debug Session - $(date) ===" >> horus-debug.log
echo "" >> horus-debug.log

# Incompatible dans WSL2
# bun run start

# Compatible dans WSL2
node dist/index.js

echo "" >> horus-debug.log
echo "=== Session ended - $(date) ===" >> horus-debug.log
