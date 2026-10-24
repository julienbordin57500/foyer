-- Foyer v4 — réactions aux petits mots, notifications.
-- Les clés de notification sont générées et gardées côté serveur (fonction foyer-push) : jamais dans l'app.

-- ─── Réactions ─────────────────────────────────────────────────────────────
create table if not exists public.note_reactions (
  id           uuid not null default gen_random_uuid() unique,
  note_id      uuid not null references public.notes(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  emoji        text not null check (emoji in ('❤️','😂','😘','👍','🥹')),
  created_at   timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index if not exists note_reactions_household_idx on public.note_reactions(household_id);
alter table public.note_reactions enable row level security;

drop policy if exists "réactions lecture" on public.note_reactions;
drop policy if exists "réactions ajout"   on public.note_reactions;
drop policy if exists "réactions modif"   on public.note_reactions;
drop policy if exists "réactions retrait" on public.note_reactions;
create policy "réactions lecture" on public.note_reactions for select to authenticated
  using (household_id = foyer_private.my_household());
create policy "réactions ajout" on public.note_reactions for insert to authenticated
  with check (household_id = foyer_private.my_household() and user_id = auth.uid()
              and exists (select 1 from public.notes n where n.id = note_reactions.note_id and n.household_id = note_reactions.household_id));
create policy "réactions modif" on public.note_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and household_id = foyer_private.my_household());
create policy "réactions retrait" on public.note_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ─── Abonnements aux notifications (un par téléphone) ──────────────────────
create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "abonnement perso" on public.push_subscriptions;
create policy "abonnement perso" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = foyer_private.my_household());

-- Clés et journal : aucune règle RLS → inaccessibles depuis l'app, seulement par le serveur.
create table if not exists public.foyer_push_keys (
  id          int primary key default 1 check (id = 1),
  public_key  text not null,
  private_key text not null
);
alter table public.foyer_push_keys enable row level security;
revoke all on public.foyer_push_keys from anon, authenticated;

create table if not exists public.foyer_push_log (
  user_id uuid not null,
  kind    text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.foyer_push_log enable row level security;
revoke all on public.foyer_push_log from anon, authenticated;

-- Secret partagé entre la base et la fonction foyer-push, généré ici, gardé dans le coffre (Vault).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'foyer_push_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'foyer_push_secret');
  end if;
end $$;

create or replace function public.foyer_push_secret()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'foyer_push_secret'
$$;
revoke execute on function public.foyer_push_secret() from public, anon, authenticated;
grant execute on function public.foyer_push_secret() to service_role;

-- ─── Déclencheurs : prévenir l'autre ───────────────────────────────────────
create extension if not exists pg_net with schema extensions;

create or replace function foyer_private.notify_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://jybymeodrcjdxqxvvggm.supabase.co/functions/v1/foyer-push',
    body := jsonb_build_object('table', tg_table_name, 'record', to_jsonb(new)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-foyer-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'foyer_push_secret')
    )
  );
  return new;
end $$;

drop trigger if exists push_notes on public.notes;
create trigger push_notes after insert on public.notes for each row execute function foyer_private.notify_push();
drop trigger if exists push_groceries on public.grocery_items;
create trigger push_groceries after insert on public.grocery_items for each row execute function foyer_private.notify_push();
drop trigger if exists push_todos on public.todos;
create trigger push_todos after insert on public.todos for each row execute function foyer_private.notify_push();
drop trigger if exists push_reactions on public.note_reactions;
create trigger push_reactions after insert or update of emoji on public.note_reactions for each row execute function foyer_private.notify_push();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_reactions'
  ) then
    alter publication supabase_realtime add table public.note_reactions;
  end if;
end $$;
