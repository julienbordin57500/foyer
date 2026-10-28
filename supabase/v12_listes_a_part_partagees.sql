-- Courses : les listes à part (traiteur…) sont visibles et modifiables par tout le foyer.
-- Elles restent séparées des courses de la maison (pas de notification, pas comptées dans l'onglet).
drop policy if exists "mes listes" on public.grocery_lists;
drop policy if exists "household data" on public.grocery_lists;
create policy "household data" on public.grocery_lists for all to authenticated
  using (household_id = foyer_private.my_household())
  with check (household_id = foyer_private.my_household());
drop policy if exists "liste perso" on public.grocery_items;
