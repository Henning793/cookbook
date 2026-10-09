-- Push-varsel når en nedtelling i kokemodus er ferdig, også når telefonen er
-- låst. Trygt å kjøre på nytt (idempotent).
--
-- Flyt: appen lagrer sluttidspunktet i cooking_timers. pg_cron sjekker hvert
-- femte sekund, og når en klokke er ferdig kaller den edge-funksjonen
-- send-timer-push, som sender varselet til telefonene i push_subscriptions.
--
-- Hemmelighetene ligger i Supabase Vault og er IKKE med her. Kjør en gang
-- per prosjekt (SQL Editor), med egne verdier:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<tilfeldig streng>', 'timer_push_cron_secret');
--   select vault.create_secret('<offentlig VAPID-nøkkel>', 'vapid_public_key');
--   select vault.create_secret('<privat VAPID-nøkkel>', 'vapid_private_key');
-- Den offentlige VAPID-nøkkelen må også stå i src/lib/timerPush.ts.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Telefonene (nettleserne) som skal få varsel, per bruker.
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "Eier administrerer egne push_subscriptions" on push_subscriptions;
create policy "Eier administrerer egne push_subscriptions"
  on push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Klokker som går. id lages av appen, så samme klokke kan oppdateres
-- (pause, +/−) og slettes. sent_at settes når varselet er sendt.
create table if not exists cooking_timers (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  body text not null default '',
  url text not null default '/',
  ends_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cooking_timers_due on cooking_timers (ends_at) where sent_at is null;

alter table cooking_timers enable row level security;

drop policy if exists "Eier administrerer egne cooking_timers" on cooking_timers;
create policy "Eier administrerer egne cooking_timers"
  on cooking_timers for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Brukes av edge-funksjonen (service_role): hemmelighetene fra Vault.
create or replace function public.timer_push_config()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'cron_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'timer_push_cron_secret'),
    'vapid_public_key', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    'vapid_private_key', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key')
  );
$$;

-- Brukes av edge-funksjonen: tar alle ferdige klokker og merker dem som
-- sendt i samme operasjon, så ingen sendes to ganger.
create or replace function public.claim_due_cooking_timers()
returns table (id uuid, user_id uuid, title text, body text, url text)
language sql
security definer
set search_path = ''
as $$
  update public.cooking_timers t
     set sent_at = now()
   where t.sent_at is null and t.ends_at <= now()
  returning t.id, t.user_id, t.title, t.body, t.url;
$$;

-- Kalles av pg_cron: vekker edge-funksjonen bare når noe er ferdig.
create or replace function public.dispatch_cooking_timer_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.cooking_timers where sent_at is null and ends_at <= now()) then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-timer-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'timer_push_cron_secret')
      ),
      body := '{}'::jsonb
    );
  end if;
end;
$$;

revoke all on function public.timer_push_config() from public, anon, authenticated;
revoke all on function public.claim_due_cooking_timers() from public, anon, authenticated;
revoke all on function public.dispatch_cooking_timer_push() from public, anon, authenticated;
grant execute on function public.timer_push_config() to service_role;
grant execute on function public.claim_due_cooking_timers() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'cooking-timer-push';
select cron.schedule('cooking-timer-push', '5 seconds', 'select public.dispatch_cooking_timer_push()');
