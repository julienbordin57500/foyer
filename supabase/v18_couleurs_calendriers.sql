-- Calendrier : une couleur de pastille par calendrier iPhone, modifiable après coup.
-- La couleur (et « Juste moi / Nous deux ») est recopiée sur ses événements, pour que l'autre la voie aussi.
-- À appliquer après v17. Idempotent : peut être relancé sans danger.
alter table public.calendar_feeds add column if not exists color text not null default '#4dabf7' check (color ~ '^#[0-9a-fA-F]{6}$');
alter table public.calendar_events add column if not exists color text check (color ~ '^#[0-9a-fA-F]{6}$');

create or replace function foyer_private.sync_feed_events()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.calendar_events
     set color = new.color, private = new.private
   where feed_id = new.id and (color is distinct from new.color or private is distinct from new.private);
  return new;
end $$;
drop trigger if exists calendar_feeds_sync on public.calendar_feeds;
create trigger calendar_feeds_sync after update of color, private on public.calendar_feeds
  for each row execute function foyer_private.sync_feed_events();
