-- Calendrier : événements et pense-bêtes ajoutés à la main (le reste vient des tâches, factures, listes et courses).
-- À appliquer après v15. Idempotent : peut être relancé sans danger.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  kind text not null default 'event' check (kind in ('event', 'memo')),
  date date not null,
  time time,
  note text check (char_length(note) <= 300),
  remind_days smallint check (remind_days between 0 and 7), -- rappel : le jour même (0) jusqu'à 7 jours avant
  remind_at timestamptz,                                     -- calculé par l'appli à partir du jour, de l'heure et du rappel
  reminded_at timestamptz,                                   -- rempli par foyer-push une fois la notification envoyée
  added_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists calendar_events_household_idx on public.calendar_events(household_id, date);
create index if not exists calendar_events_remind_idx on public.calendar_events(remind_at) where reminded_at is null;
alter table public.calendar_events enable row level security;
drop policy if exists "household data" on public.calendar_events;
create policy "household data" on public.calendar_events for all to authenticated
  using (household_id = foyer_private.my_household())
  with check (household_id = foyer_private.my_household());
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_events') then
    alter publication supabase_realtime add table public.calendar_events;
  end if;
end $$;
