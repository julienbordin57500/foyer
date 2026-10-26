-- Petits mots : leur auteur peut aussi les corriger.
drop policy if exists "mots modification" on public.notes;
create policy "mots modification" on public.notes for update to authenticated
  using (household_id = foyer_private.my_household() and author = auth.uid())
  with check (household_id = foyer_private.my_household() and author = auth.uid());
