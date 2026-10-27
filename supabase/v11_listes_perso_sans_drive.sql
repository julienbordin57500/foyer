-- Courses : listes à part (traiteur…), visibles seulement par la personne qui les a créées.
create table if not exists public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  emoji text not null default '📦' check (char_length(emoji) <= 16),
  created_at timestamptz not null default now()
);
create index if not exists grocery_lists_owner_idx on public.grocery_lists(owner);
alter table public.grocery_lists enable row level security;
drop policy if exists "mes listes" on public.grocery_lists;
create policy "mes listes" on public.grocery_lists for all to authenticated
  using (owner = auth.uid() and household_id = foyer_private.my_household())
  with check (owner = auth.uid() and household_id = foyer_private.my_household());
alter publication supabase_realtime add table public.grocery_lists;

-- Un article sans liste = les courses de la maison. Avec une liste : seul son propriétaire le voit.
alter table public.grocery_items add column if not exists list_id uuid references public.grocery_lists(id) on delete cascade;
create index if not exists grocery_items_list_idx on public.grocery_items(list_id);
drop policy if exists "liste perso" on public.grocery_items;
create policy "liste perso" on public.grocery_items as restrictive for all to authenticated
  using (list_id is null or list_id in (select id from public.grocery_lists where owner = auth.uid()))
  with check (list_id is null or list_id in (select id from public.grocery_lists where owner = auth.uid()));

-- Le drive ne sert plus : tout redevient « en magasin ».
update public.grocery_items set place = 'store', status = case when status = 'ordered' then 'todo' else status end
  where place <> 'store' or status = 'ordered';
