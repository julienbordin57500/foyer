-- Point du matin : chacun peut le couper ; la date évite de l'envoyer deux fois.
alter table public.members add column if not exists morning_digest boolean not null default true;
alter table public.members add column if not exists digest_sent_on date;
