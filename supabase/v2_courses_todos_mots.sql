-- Foyer v2 — courses partagées, à faire, petits mots.
-- À exécuter après schema.sql (qui crée foyers, membres et foyer_private.my_household()).

create table if not exists public.grocery_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 80),
  quantity     text check (length(quantity) <= 20),
  category     text not null default 'Autre' check (category in
                 ('Fruits & légumes','Frais','Épicerie','Surgelés','Boissons','Maison & hygiène','Bébé','Autre')),
  drive        boolean not null default false,
  status       text not null default 'todo' check (status in ('todo','ordered','bought')),
  added_by     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bought_at    timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.todos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 140),
  assignee     uuid references auth.users(id) on delete set null, -- null = tous les deux
  due_date     date,
  added_by     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  done_by      uuid references auth.users(id) on delete set null,
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  body         text not null check (length(trim(body)) between 1 and 280),
  author       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists grocery_items_household_idx on public.grocery_items(household_id);
create index if not exists todos_household_idx         on public.todos(household_id);
create index if not exists notes_household_idx         on public.notes(household_id, created_at desc);

alter table public.grocery_items enable row level security;
alter table public.todos         enable row level security;
alter table public.notes         enable row level security;

-- Courses et tâches : tout le foyer lit et modifie. On ne peut ajouter qu'en son propre nom.
do $$
declare t text;
begin
  foreach t in array array['grocery_items','todos'] loop
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

-- Petits mots : lus par le foyer, écrits et supprimés uniquement par leur auteur.
drop policy if exists "mots lecture"     on public.notes;
drop policy if exists "mots ajout"       on public.notes;
drop policy if exists "mots suppression" on public.notes;
create policy "mots lecture" on public.notes for select to authenticated
  using (household_id = foyer_private.my_household());
create policy "mots ajout" on public.notes for insert to authenticated
  with check (household_id = foyer_private.my_household() and author = auth.uid());
create policy "mots suppression" on public.notes for delete to authenticated
  using (household_id = foyer_private.my_household() and author = auth.uid());

-- Temps réel : ce que l'un ajoute apparaît aussitôt chez l'autre.
do $$
declare t text;
begin
  foreach t in array array['grocery_items','todos','notes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
