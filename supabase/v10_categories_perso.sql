-- Courses : catégories créées à la main par le foyer, proposées ensuite pour tous les articles.
create table if not exists public.grocery_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '🏷️' check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  unique (household_id, name)
);
create index if not exists grocery_categories_household_idx on public.grocery_categories(household_id);
alter table public.grocery_categories enable row level security;
drop policy if exists "household data" on public.grocery_categories;
create policy "household data" on public.grocery_categories for all to authenticated
  using (household_id = foyer_private.my_household())
  with check (household_id = foyer_private.my_household());
alter publication supabase_realtime add table public.grocery_categories;
-- Les articles peuvent maintenant porter une catégorie créée à la main.
alter table public.grocery_items drop constraint if exists grocery_items_category_check;
alter table public.grocery_items add constraint grocery_items_category_check check (char_length(category) between 1 and 40);
