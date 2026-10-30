#!/bin/bash
# Crée le fichier du prochain changement de base (supabase/vN_nom.sql) avec le bon numéro.
# N'applique rien dans Supabase.
#
# Utilisation : ./scripts/nouvelle-migration.sh nom_court   (ex. courses_favoris)
set -euo pipefail
cd "$(dirname "$0")/.."

NOM="${1:-}"
if ! [[ "$NOM" =~ ^[a-z0-9_]+$ ]]; then
  echo "Utilisation : $0 nom_court   (minuscules, chiffres et _ seulement)"; exit 1
fi

DERNIER="$(ls supabase/v*_*.sql 2>/dev/null | sed -E 's#.*/v([0-9]+)_.*#\1#' | sort -n | tail -1)"
N=$(( ${DERNIER:-1} + 1 ))
FICHIER="supabase/v${N}_${NOM}.sql"

cat > "$FICHIER" <<EOF
-- (décrire ici en une phrase ce que ce changement apporte)
-- À appliquer après v${DERNIER:-1}. Idempotent : peut être relancé sans danger.

-- create table if not exists public.xxx (
--   id uuid primary key default gen_random_uuid(),
--   household_id uuid not null references public.households(id) on delete cascade,
--   created_at timestamptz not null default now()
-- );
-- alter table public.xxx enable row level security;
-- drop policy if exists "household data" on public.xxx;
-- create policy "household data" on public.xxx for all to authenticated
--   using (household_id = foyer_private.my_household())
--   with check (household_id = foyer_private.my_household());
EOF

echo "✅ Créé : $FICHIER"
