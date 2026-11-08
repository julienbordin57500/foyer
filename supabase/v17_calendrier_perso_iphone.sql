-- Calendrier : événements « Juste moi » (invisibles pour l'autre, protégé par la base)
-- et import des calendriers de l'iPhone par leur lien iCloud public.
-- À appliquer après v16. Idempotent : peut être relancé sans danger.

-- Calendriers iPhone à importer : le lien n'est visible que par son propriétaire.
create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  url text not null check (url ~* '^(webcal|https)://[a-z0-9.-]+\.icloud\.com/' and char_length(url) <= 500),
  private boolean not null default true,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists calendar_feeds_owner_idx on public.calendar_feeds(owner);
alter table public.calendar_feeds enable row level security;
drop policy if exists "mes calendriers" on public.calendar_feeds;
create policy "mes calendriers" on public.calendar_feeds for all to authenticated
  using (owner = auth.uid() and household_id = foyer_private.my_household())
  with check (owner = auth.uid() and household_id = foyer_private.my_household());

alter table public.calendar_events add column if not exists private boolean not null default false;
alter table public.calendar_events add column if not exists feed_id uuid references public.calendar_feeds(id) on delete cascade;
alter table public.calendar_events add column if not exists source_uid text check (char_length(source_uid) <= 400);
create unique index if not exists calendar_events_source_idx on public.calendar_events(feed_id, source_uid);

-- « Juste moi » : seule la personne qui l'a ajouté le voit, le modifie ou le supprime.
drop policy if exists "juste moi" on public.calendar_events;
create policy "juste moi" on public.calendar_events as restrictive for all to authenticated
  using (not private or added_by = auth.uid())
  with check (not private or added_by = auth.uid());
