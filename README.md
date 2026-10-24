# Foyer

PWA du foyer, à deux : liste de courses partagée (rayons automatiques, drive), choses à faire et petits mots.
React + Vite + TypeScript + Tailwind, Supabase (auth, base, temps réel).

## Démarrer en local

```bash
npm install
npm run dev
```

Sans fichier `.env`, l'app tourne en **mode démo** : données d'exemple stockées dans le navigateur
(deux onglets ouverts se synchronisent entre eux, pour simuler les deux téléphones).

## Brancher Supabase

1. Créez un projet sur supabase.com.
2. Dans **SQL Editor**, exécutez `supabase/schema.sql`, puis `v2_…` à `v5_…` dans l'ordre (tables, RLS, temps réel).
3. Copiez `.env.example` en `.env` et renseignez l'URL du projet et la clé publique (anon / publishable),
   disponibles dans **Project Settings → API**.
4. Facultatif : dans **Authentication → Providers → Email**, désactivez « Confirm email »
   pour éviter l'étape de confirmation par mail.
5. Premier compte : « Créer » un foyer. Le code d'invitation s'affiche dans les réglages (icône ⚙︎ sur l'accueil).
   Second compte : « Rejoindre » avec ce code. Un foyer accepte deux membres au maximum.

## Notifications

La fonction `supabase/functions/foyer-push` envoie les notifications. Elle crée elle-même ses clés au premier appel
et les garde côté serveur ; la base l'appelle à chaque nouveau mot, article, tâche, réaction ou « je pars »,
et chaque minute pour les rappels arrivés à échéance (`v4_…sql`, `v5_…sql`). Elle sert aussi le fichier calendrier (`?ics=1`).
Déploiement : `supabase functions deploy foyer-push --no-verify-jwt` (elle vérifie elle-même un secret partagé).

## Installer sur le téléphone

Chaque push sur `main` publie l'app sur https://julienbordin57500.github.io/foyer/ (GitHub Actions).
- iPhone : Safari → Partager → « Sur l'écran d'accueil ».
- Android : Chrome → menu → « Installer l'application ».

## Structure

- `supabase/` — foyers et membres (`schema.sql`), courses, tâches et petits mots (`v2_…sql`), RLS par foyer
- `src/data/` — accès aux données (Supabase ou démo) et store React avec mises à jour optimistes
- `src/lib/categorize.ts` — rangement automatique des articles par rayon
- `scripts/icons.mjs` — génère les icônes à partir du logo
- `src/pages/` — Accueil (petits mots), Courses, À faire, Listes

Les tables `products`, `subscriptions`, `charges` et `incomes` de la v1 ne sont plus utilisées.
