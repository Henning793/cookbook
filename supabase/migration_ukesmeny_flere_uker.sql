-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_hovedrett_porsjoner.sql. Trygt å kjøre på nytt (idempotent).
--
-- Ukesmenyen får uker med dato, så man kan planlegge flere uker frem i tid.
-- week_start er mandagen i uken. Dagene som finnes nå blir denne uken.
-- Standardverdien (denne ukens mandag, norsk tid) gjør at en eldre versjon av
-- appen fortsatt skriver til denne uken mens ny kode rulles ut.

alter table menu_days
  add column if not exists week_start date
  default (date_trunc('week', now() at time zone 'Europe/Oslo'))::date;

update menu_days
  set week_start = (date_trunc('week', now() at time zone 'Europe/Oslo'))::date
  where week_start is null;

alter table menu_days alter column week_start set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_days_week_start_monday') then
    alter table menu_days
      add constraint menu_days_week_start_monday check (extract(isodow from week_start) = 1);
  end if;
end $$;

-- Maks én rad per ukedag per uke (før: per ukedag).
drop index if exists menu_days_family_weekday_key;
drop index if exists menu_days_personal_owner_weekday_key;

create unique index if not exists menu_days_family_week_weekday_key
  on menu_days (family_id, week_start, weekday) where family_id is not null;

create unique index if not exists menu_days_personal_owner_week_weekday_key
  on menu_days (owner_id, week_start, weekday) where family_id is null;
