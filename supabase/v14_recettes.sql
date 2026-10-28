-- Courses : recettes du foyer (ajoutées à la main ou modifiées), proposées ensuite avec celles d'office.
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  emoji text not null default '🍽️' check (char_length(emoji) <= 16),
  ingredients text[] not null default '{}' check (cardinality(ingredients) <= 40),
  added_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists recipes_household_idx on public.recipes(household_id);
alter table public.recipes enable row level security;
drop policy if exists "household data" on public.recipes;
create policy "household data" on public.recipes for all to authenticated
  using (household_id = foyer_private.my_household())
  with check (household_id = foyer_private.my_household());
alter publication supabase_realtime add table public.recipes;
