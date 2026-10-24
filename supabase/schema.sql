-- Foyer — schéma Supabase
-- À exécuter une fois dans Supabase > SQL Editor.
-- Un foyer = deux comptes maximum. Toutes les données sont isolées par foyer via RLS.

-- ─── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Notre foyer',
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  stock        integer not null default 0 check (stock >= 0),
  threshold    integer not null default 1 check (threshold >= 0),
  created_at   timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  name            text not null,
  amount          numeric(10,2) not null check (amount >= 0),
  debit_day       smallint not null check (debit_day between 1 and 31),
  cancel_deadline date,
  created_at      timestamptz not null default now()
);

create table if not exists public.charges (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label        text not null,
  category     text not null check (category in
                 ('Logement','Énergie','Assurance','Transport','Alimentation','Loisirs','Santé','Autre')),
  amount       numeric(10,2) not null check (amount >= 0),
  debit_day    smallint check (debit_day between 1 and 31),
  created_at   timestamptz not null default now()
);

create table if not exists public.incomes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label        text not null,
  amount       numeric(10,2) not null check (amount >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists products_household_idx      on public.products(household_id);
create index if not exists subscriptions_household_idx on public.subscriptions(household_id);
create index if not exists charges_household_idx       on public.charges(household_id);
create index if not exists incomes_household_idx       on public.incomes(household_id);
create index if not exists members_household_idx       on public.members(household_id);

-- ─── Fonctions ─────────────────────────────────────────────────────────────

-- Foyer de l'utilisateur connecté (security definer pour éviter la récursion RLS).
-- Rangée dans un schéma non exposé par l'API : utilisable par les règles RLS, pas appelable en direct.
create schema if not exists foyer_private;
revoke all on schema foyer_private from public, anon;
grant usage on schema foyer_private to authenticated;

create or replace function foyer_private.my_household()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.members where user_id = auth.uid()
$$;

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'Vous faites déjà partie d''un foyer';
  end if;
  insert into households(name) values (coalesce(nullif(trim(p_name), ''), 'Notre foyer')) returning id into hid;
  insert into members(user_id, household_id, display_name) values (auth.uid(), hid, trim(p_display_name));
  return hid;
end $$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'Vous faites déjà partie d''un foyer';
  end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'Code d''invitation inconnu'; end if;
  if (select count(*) from members where household_id = hid) >= 2 then
    raise exception 'Ce foyer est déjà complet';
  end if;
  insert into members(user_id, household_id, display_name) values (auth.uid(), hid, trim(p_display_name));
  return hid;
end $$;

-- Ajustement atomique du stock : deux appuis simultanés sur deux téléphones ne s'écrasent pas.
create or replace function public.adjust_stock(p_id uuid, p_delta integer)
returns integer language sql security invoker set search_path = public as $$
  update products set stock = greatest(0, stock + p_delta)
  where id = p_id and household_id = foyer_private.my_household()
  returning stock
$$;

revoke execute on function foyer_private.my_household()                 from public, anon;
revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text)   from public, anon;
revoke execute on function public.adjust_stock(uuid, integer)  from public, anon;
grant  execute on function foyer_private.my_household()                 to authenticated;
grant  execute on function public.create_household(text, text) to authenticated;
grant  execute on function public.join_household(text, text)   to authenticated;
grant  execute on function public.adjust_stock(uuid, integer)  to authenticated;

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.households    enable row level security;
alter table public.members       enable row level security;
alter table public.products      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.charges       enable row level security;
alter table public.incomes       enable row level security;

drop policy if exists "household read"   on public.households;
drop policy if exists "household update" on public.households;
create policy "household read"   on public.households for select to authenticated using (id = foyer_private.my_household());
create policy "household update" on public.households for update to authenticated using (id = foyer_private.my_household()) with check (id = foyer_private.my_household());

drop policy if exists "members read"       on public.members;
drop policy if exists "members update self" on public.members;
create policy "members read"        on public.members for select to authenticated using (household_id = foyer_private.my_household());
create policy "members update self" on public.members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = foyer_private.my_household()); -- impossible de changer de foyer

do $$
declare t text;
begin
  foreach t in array array['products','subscriptions','charges','incomes'] loop
    execute format('drop policy if exists "household data" on public.%I', t);
    execute format(
      'create policy "household data" on public.%I for all to authenticated
         using (household_id = foyer_private.my_household())
         with check (household_id = foyer_private.my_household())', t);
  end loop;
end $$;

-- ─── Temps réel ────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['products','subscriptions','charges','incomes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
