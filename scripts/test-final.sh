#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Test Final - Correctif EPERM WSL2                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Ce test va lancer Horus CLI avec le mode DEBUG."
echo ""
echo "🎯 Objectif: Vérifier que l'application NE SE FERME PAS"
echo "   quand vous tapez un caractère."
echo ""
echo "📝 Instructions:"
echo "   1. Attendez que le prompt 'Ask anything...' apparaisse"
echo "   2. Tapez quelques lettres (par exemple: 'hello')"
echo "   3. L'application doit continuer à fonctionner"
echo "   4. Appuyez sur Ctrl+C deux fois pour quitter"
echo ""
echo "✅ Succès = L'application reste ouverte et affiche ce que vous tapez"
echo "❌ Échec  = L'application se ferme après la première lettre"
echo ""
echo "Lancement dans 3 secondes..."
sleep 3
echo ""

DEBUG=1 bun run dist/index.js
