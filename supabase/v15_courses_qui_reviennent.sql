-- Courses : un article peut revenir tout seul sur la liste, N mois après avoir été acheté (filtre à café tous les 2 mois…).
-- À appliquer après v14. Idempotent : peut être relancé sans danger.
alter table public.grocery_items add column if not exists repeat_months smallint check (repeat_months between 1 and 24);
