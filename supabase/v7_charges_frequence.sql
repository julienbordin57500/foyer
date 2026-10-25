-- Foyer v7 — charges fixes avec une fréquence (tous les mois, 2 mois, 3 mois, 6 mois ou 1 an).
-- La table charges existe depuis la v1 (schema.sql) ; on lui ajoute la fréquence.
alter table public.charges add column if not exists every_months smallint not null default 1
  check (every_months in (1, 2, 3, 6, 12));
