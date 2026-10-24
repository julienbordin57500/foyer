-- Foyer v5 — rappels à l'heure choisie, tâches qui reviennent, « je pars faire les courses ».

-- ─── Rappels (tâches et éléments de liste) ────────────────────────────────
alter table public.todos add column if not exists remind_at   timestamptz;
alter table public.todos add column if not exists remind_to   uuid references auth.users(id) on delete set null; -- null = tous les deux
alter table public.todos add column if not exists reminded_at timestamptz;
alter table public.todos add column if not exists repeat      text check (repeat in ('day','week','2weeks','month'));

alter table public.list_items add column if not exists remind_at   timestamptz;
alter table public.list_items add column if not exists remind_to   uuid references auth.users(id) on delete set null;
alter table public.list_items add column if not exists reminded_at timestamptz;

create index if not exists todos_remind_idx      on public.todos(remind_at)      where reminded_at is null;
create index if not exists list_items_remind_idx on public.list_items(remind_at) where reminded_at is null;

-- ─── « Je pars faire les courses » ─────────────────────────────────────────
create table if not exists public.pings (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('shopping')),
  place        text check (place in ('store','drive')),
  created_at   timestamptz not null default now()
);
create index if not exists pings_household_idx on public.pings(household_id, created_at desc);
alter table public.pings enable row level security;
drop policy if exists "pings lecture" on public.pings;
drop policy if exists "pings ajout"   on public.pings;
create policy "pings lecture" on public.pings for select to authenticated
  using (household_id = foyer_private.my_household());
create policy "pings ajout" on public.pings for insert to authenticated
  with check (household_id = foyer_private.my_household() and author = auth.uid());

drop trigger if exists push_pings on public.pings;
create trigger push_pings after insert on public.pings for each row execute function foyer_private.notify_push();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pings'
  ) then
    alter publication supabase_realtime add table public.pings;
  end if;
end $$;

-- ─── Envoi des rappels : vérifié chaque minute ─────────────────────────────
create extension if not exists pg_cron;

create or replace function foyer_private.send_due_reminders()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- On n'appelle la fonction d'envoi que s'il y a vraiment quelque chose à envoyer.
  if exists (select 1 from public.todos where remind_at <= now() and reminded_at is null and done_at is null)
     or exists (select 1 from public.list_items where remind_at <= now() and reminded_at is null and not done) then
    perform net.http_post(
      url := 'https://jybymeodrcjdxqxvvggm.supabase.co/functions/v1/foyer-push',
      body := jsonb_build_object('table', 'reminders'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-foyer-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'foyer_push_secret')
      )
    );
  end if;
end $$;

select cron.unschedule('foyer-reminders') where exists (select 1 from cron.job where jobname = 'foyer-reminders');
select cron.schedule('foyer-reminders', '* * * * *', 'select foyer_private.send_due_reminders()');
