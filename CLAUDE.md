# Foyer — repères pour Claude

Appli (PWA) de Julien et Claire, à deux : courses partagées (rayons, drive, recettes), choses à faire,
factures et charges, listes, petits mots, notifications. Toujours répondre en français, à un novice.

## Techno
- React 19 + Vite + TypeScript + Tailwind 4, `vite-plugin-pwa` (mise à jour automatique sur les téléphones).
- Supabase (connexion, base, temps réel). Les tables sont dans le projet Supabase **biberons-noah**
  (`jybymeodrcjdxqxvvggm`), partagé avec le carnet de Noah : ne jamais toucher aux tables de Noah.
- Sans `.env`, l'appli tourne en **mode démo** (données dans le navigateur) : c'est ce qu'on teste en local.
- Publication : chaque push sur `main` → GitHub Actions → https://julienbordin57500.github.io/foyer/

## Commandes
- Lancer en local : `npm install` (une fois) puis `npm run dev` → http://localhost:5173/foyer/
- Vérifier avant de publier : `./scripts/verifier.sh` (installe si besoin, compile, contrôle le code).
- Nouveau changement de base : `./scripts/nouvelle-migration.sh nom_court` → crée `supabase/vN_nom_court.sql`.
- Publier : commit + `git push` sur `main` (après accord), puis vérifier que l'action GitHub passe au vert.

## Structure
- `src/pages/` : Accueil (`Home`), Courses (`Groceries`), À faire (`Todos`), Factures (`Bills`), Listes (`Lists`)
- `src/data/store.tsx` (état + mises à jour optimistes), `src/data/backends.ts` (Supabase ou démo)
- `src/lib/` : `categorize.ts` (rayons auto), `recipes.ts`, `reminders.ts`, `theme.ts`, `weather.ts`, `types.ts`
- `src/components/` : feuilles (Settings, Recipe…), `ui.tsx` (éléments communs)
- `supabase/schema.sql` puis `v2_…` → `v14_…` : à appliquer dans l'ordre ; `functions/foyer-push` : notifications
- `public/push-sw.js` : réception des notifications ; `scripts/icons.mjs` : icônes depuis le logo

## Conventions
- Toute nouveauté qui touche les données doit marcher aussi en mode démo (`backends.ts`) et dans `types.ts`.
- Base : un fichier `supabase/vN_nom.sql` par changement, idempotent (`if not exists`, `drop policy if exists`),
  avec la règle d'accès « household data » (`foyer_private.my_household()`). L'appliquer via le connecteur
  Supabase ou l'éditeur SQL, après accord.
- Design « nuit vibrante » : sombre par défaut, une carte d'en-tête en dégradé par section,
  titres en Newsreader (garder la police). Fenêtres de modification : de haut en bas, centrées
  (pas d'options côte à côte). Textes au féminin quand ils parlent de Claire.
- Pas de fichier de notes de version. Messages de commit en français : ce qui change, page par page.

## Ne pas toucher sans demander
- Les tables et fonctions Supabase qui ne commencent pas par le foyer (celles de Noah), les règles d'accès.
- `foyer-push` (clés de notification gardées côté serveur, jamais dans le chat) et la tâche pg_cron des rappels.
- `.github/workflows/`, `vite.config.ts` (`base: '/foyer/'`). Ne jamais committer de `.env`.
- Tables de la v1 (`products`, `subscriptions`, `charges`, `incomes`) : plus utilisées, ne pas supprimer.
