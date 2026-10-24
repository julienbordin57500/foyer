# Foyer

PWA de gestion du foyer à deux : courses avec stock, abonnements, charges et tableau de bord.
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
2. Dans **SQL Editor**, exécutez `supabase/schema.sql` (tables, RLS, fonctions, temps réel).
3. Copiez `.env.example` en `.env` et renseignez l'URL du projet et la clé publique (anon / publishable),
   disponibles dans **Project Settings → API**.
4. Facultatif : dans **Authentication → Providers → Email**, désactivez « Confirm email »
   pour éviter l'étape de confirmation par mail.
5. Premier compte : « Créer » un foyer. Le code d'invitation s'affiche dans les réglages (icône ⚙︎ sur l'accueil).
   Second compte : « Rejoindre » avec ce code. Un foyer accepte deux membres au maximum.

## Installer sur le téléphone

`npm run build` puis déployez le dossier `dist/` (Vercel, Netlify, Cloudflare Pages…) en HTTPS.
- iPhone : Safari → Partager → « Sur l'écran d'accueil ».
- Android : Chrome → menu → « Installer l'application ».

## Structure

- `supabase/schema.sql` — schéma, RLS par foyer, `adjust_stock` atomique (deux appuis simultanés ne s'écrasent pas)
- `src/data/` — accès aux données (Supabase ou démo) et store React avec mises à jour optimistes
- `src/lib/finance.ts` — reste à vivre, prélèvements à venir, échéances, tri du stock
- `src/pages/` — Accueil, Courses, Abonnements, Budget
