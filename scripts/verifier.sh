#!/bin/bash
# Vérifie que l'appli est prête à être publiée : installe les dépendances si besoin,
# compile (comme le fera GitHub), puis contrôle le code. Ne publie rien.
#
# Utilisation : ./scripts/verifier.sh
set -uo pipefail
cd "$(dirname "$0")/.."

# N'installe que si c'est nécessaire (première fois ou package-lock.json changé)
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "📦 Installation des dépendances…"
  npm ci --no-audit --no-fund --silent || { echo "❌ Installation impossible."; exit 1; }
  touch node_modules
fi

echo "🔨 Compilation…"
if ! npm run --silent build >/tmp/foyer-build.log 2>&1; then
  tail -30 /tmp/foyer-build.log
  echo "❌ La compilation échoue : GitHub ne pourra pas publier. Corriger avant de pousser."
  exit 1
fi

# --quiet : seulement les vraies erreurs (les simples avertissements sont nombreux et ne bloquent pas)
echo "🔎 Contrôle du code…"
if ! npm run --silent lint -- --quiet; then
  echo "❌ Le contrôle du code signale des erreurs."
  exit 1
fi

echo "✅ Prêt à publier."
