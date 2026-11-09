-- Calendrier : événements sur plusieurs jours (vacances du… au…) et événements qui se répètent
-- (chaque semaine, mois ou année : anniversaires…). À appliquer après v18. Idempotent.
alter table public.calendar_events add column if not exists end_date date;
alter table public.calendar_events add column if not exists repeat text check (repeat in ('week', 'month', 'year'));
alter table public.calendar_events drop constraint if exists calendar_events_end_after_start;
alter table public.calendar_events add constraint calendar_events_end_after_start check (end_date is null or end_date >= date);
