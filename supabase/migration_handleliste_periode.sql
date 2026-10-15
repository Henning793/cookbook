-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_flere_uker.sql. Trygt å kjøre på nytt (idempotent).
--
-- Handlelisten kan dekke en uke, de neste 7 dagene eller en måned, og hver
-- person velger selv under «Personaliser handlelisten».

-- 1) En avkrysning gjelder alt varen trengs til til og med covered_through
--    (siste dag i perioden personen så da varen ble krysset av). Trengs
--    varen igjen etter den dagen, kommer den tilbake med bare den nye
--    mengden. Standardverdien (søndag denne uken, norsk tid) gjør at
--    eksisterende avkrysninger og en eldre versjon av appen virker som før.
alter table shopping_checked_items
  add column if not exists covered_through date
  default ((date_trunc('week', now() at time zone 'Europe/Oslo'))::date + 6);

update shopping_checked_items
  set covered_through = (date_trunc('week', now() at time zone 'Europe/Oslo'))::date + 6
  where covered_through is null;

-- 2) Hver persons valg. week = denne uken, next7 = de neste 7 dagene,
--    month = denne uken og de 4 neste.
create table if not exists shopping_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  range text not null default 'week' check (range in ('week', 'next7', 'month')),
  updated_at timestamptz not null default now()
);

alter table shopping_preferences enable row level security;

drop policy if exists "Eier kan se shopping_preferences" on shopping_preferences;
create policy "Eier kan se shopping_preferences"
  on shopping_preferences for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Eier administrerer shopping_preferences" on shopping_preferences;
create policy "Eier administrerer shopping_preferences"
  on shopping_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
