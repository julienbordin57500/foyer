-- Foyer v6 — factures : montant, date limite, qui s'en occupe, récurrence, prélèvement automatique,
-- partage (« qui doit quoi »), rappels 3 jours avant puis le jour même (voir foyer-push).

create table if not exists public.bills (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 80),
  amount       numeric(10,2) not null check (amount >= 0),
  due_date     date not null,
  assignee     uuid references auth.users(id) on delete set null, -- null = tous les deux
  repeat       text check (repeat in ('month','quarter','year')),
  auto_debit   boolean not null default false,  -- prélèvement : se coche tout seul le jour J
  shared       boolean not null default false,  -- moitié chacun, compte dans « qui doit quoi »
  paid_at      timestamptz,
  paid_by      uuid references auth.users(id) on delete set null,
  settled      boolean not null default false,  -- remis à zéro dans « qui doit quoi »
  reminded_soon boolean not null default false,
  reminded_due  boolean not null default false,
  added_by     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists bills_household_idx on public.bills(household_id, due_date);
alter table public.bills enable row level security;
drop policy if exists "foyer lecture" on public.bills;
drop policy if exists "foyer ajout" on public.bills;
drop policy if exists "foyer modif" on public.bills;
drop policy if exists "foyer suppression" on public.bills;
create policy "foyer lecture" on public.bills for select to authenticated using (household_id = foyer_private.my_household());
create policy "foyer ajout" on public.bills for insert to authenticated with check (household_id = foyer_private.my_household() and added_by = auth.uid());
create policy "foyer modif" on public.bills for update to authenticated using (household_id = foyer_private.my_household()) with check (household_id = foyer_private.my_household());
create policy "foyer suppression" on public.bills for delete to authenticated using (household_id = foyer_private.my_household());

drop trigger if exists push_bills on public.bills;
create trigger push_bills after insert on public.bills for each row execute function foyer_private.notify_push();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bills') then
    alter publication supabase_realtime add table public.bills;
  end if;
end $$;

-- La vérification de chaque minute regarde aussi les factures (entre 9 h et 21 h, heure de Paris).
create or replace function foyer_private.send_due_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare
  paris_hour int := extract(hour from (now() at time zone 'Europe/Paris'));
  paris_day date := (now() at time zone 'Europe/Paris')::date;
begin
  if exists (select 1 from public.todos where remind_at <= now() and reminded_at is null and done_at is null)
     or exists (select 1 from public.list_items where remind_at <= now() and reminded_at is null and not done)
     or (paris_hour between 9 and 20 and exists (
           select 1 from public.bills where paid_at is null and (
             (not auto_debit and not reminded_soon and due_date - 3 <= paris_day)
             or (not auto_debit and not reminded_due and due_date <= paris_day)
             or (auto_debit and due_date <= paris_day))))
  then
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
