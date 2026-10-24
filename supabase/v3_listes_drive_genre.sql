-- Foyer v3 — listes, article drive et/ou magasin, accords selon la personne.

-- Courses : « où » remplace le simple drive oui/non.
alter table public.grocery_items add column if not exists place text not null default 'store'
  check (place in ('store','drive','both'));
update public.grocery_items set place = 'drive' where drive and place = 'store';
alter table public.grocery_items drop column if exists drive;

-- Membres : pour accorder les textes (« elle le verra »).
alter table public.members add column if not exists gender text check (gender in ('f','m'));

-- Listes réutilisables (valise, Ikea, bricolage…)
create table if not exists public.lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 60),
  emoji        text not null default '📋' check (length(emoji) <= 16),
  added_by     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists public.list_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list_id      uuid not null references public.lists(id) on delete cascade,
  text         text not null check (length(trim(text)) between 1 and 120),
  done         boolean not null default false,
  done_by      uuid references auth.users(id) on delete set null,
  added_by     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists lists_household_idx      on public.lists(household_id);
create index if not exists list_items_household_idx on public.list_items(household_id);
create index if not exists list_items_list_idx      on public.list_items(list_id);

alter table public.lists      enable row level security;
alter table public.list_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['lists','list_items'] loop
    execute format('drop policy if exists "foyer lecture" on public.%I', t);
    execute format('drop policy if exists "foyer ajout" on public.%I', t);
    execute format('drop policy if exists "foyer modif" on public.%I', t);
    execute format('drop policy if exists "foyer suppression" on public.%I', t);
    execute format('create policy "foyer lecture" on public.%I for select to authenticated
                      using (household_id = foyer_private.my_household())', t);
    execute format('create policy "foyer ajout" on public.%I for insert to authenticated
                      with check (household_id = foyer_private.my_household() and added_by = auth.uid())', t);
    execute format('create policy "foyer modif" on public.%I for update to authenticated
                      using (household_id = foyer_private.my_household())
                      with check (household_id = foyer_private.my_household())', t);
    execute format('create policy "foyer suppression" on public.%I for delete to authenticated
                      using (household_id = foyer_private.my_household())', t);
  end loop;
end $$;

-- Un élément ne peut pointer que vers une liste du même foyer.
create or replace function foyer_private.check_list_household()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from lists where id = new.list_id and household_id = new.household_id) then
    raise exception 'Liste inconnue';
  end if;
  return new;
end $$;
drop trigger if exists list_items_household on public.list_items;
create trigger list_items_household before insert or update of list_id, household_id on public.list_items
  for each row execute function foyer_private.check_list_household();

do $$
declare t text;
begin
  foreach t in array array['lists','list_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Accords : à renseigner pour chaque membre ('f' ou 'm'), par exemple :
-- update public.members set gender = 'f' where display_name = 'Claire';
