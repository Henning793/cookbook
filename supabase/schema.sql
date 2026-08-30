-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query
-- Trygt å kjøre på nytt (idempotent) selv om tabellene/policyene allerede finnes.

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  -- Liste av { amount: number | null, unit: string, name: string }.
  ingredients jsonb not null,
  -- Liste av tekststrenger, ett per steg i fremgangsmåten (vises numrert i appen).
  steps jsonb not null,
  image_url text
);

-- Endrer eksisterende installasjoner fra fritekst-kolonner til strukturert
-- jsonb. Trygt å kjøre på nytt (no-op) hvis kolonnene allerede er jsonb.
-- NB: dette forutsetter at recipes-tabellen er tom eller at du er komfortabel
-- med at gamle fritekst-oppskrifter mister innholdet sitt (erstattes med
-- tomme lister) - de kan i så fall skrives inn på nytt via det nye skjemaet.
do $$
begin
  if (select data_type from information_schema.columns where table_name = 'recipes' and column_name = 'ingredients') = 'text' then
    alter table recipes
      alter column ingredients type jsonb using '[]'::jsonb,
      alter column steps type jsonb using '[]'::jsonb;
  end if;
end $$;

-- Hvem oppskriften tilhører. NB: ikke "not null" her - se README for hvorfor
-- (auth.uid() er NULL når SQL kjøres direkte i SQL Editor, så en NOT NULL-
-- kolonne med denne default-verdien ville feilet på eksisterende rader).
-- Nye oppskrifter lagt til fra appen får owner_id satt automatisk via
-- default-verdien, siden de går via en innlogget request.
alter table recipes add column if not exists owner_id uuid references auth.users(id) default auth.uid();

-- Etiketter (f.eks. "Middag", "Saus", "Bakst") - en enkel liste med
-- tekststrenger. Trygt å sette NOT NULL med en fast default her, i
-- motsetning til owner_id over, siden '{}' ikke er avhengig av innlogging.
alter table recipes add column if not exists tags text[] not null default '{}';

alter table recipes enable row level security;

-- Alle (også ikke-innloggede) kan lese oppskrifter, siden de skal deles med hele familien.
drop policy if exists "Alle kan lese oppskrifter" on recipes;
create policy "Alle kan lese oppskrifter"
  on recipes for select
  to anon, authenticated
  using (true);

-- Man kan kun legge til oppskrifter i sin egen kokebok.
drop policy if exists "Innloggede kan legge til oppskrifter" on recipes;
drop policy if exists "Innloggede kan legge til i egen kokebok" on recipes;
create policy "Innloggede kan legge til i egen kokebok"
  on recipes for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Man kan kun endre/slette sine egne oppskrifter, ikke andres.
drop policy if exists "Innloggede kan endre oppskrifter" on recipes;
drop policy if exists "Innloggede kan endre egne oppskrifter" on recipes;
create policy "Innloggede kan endre egne oppskrifter"
  on recipes for update
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Innloggede kan slette oppskrifter" on recipes;
drop policy if exists "Innloggede kan slette egne oppskrifter" on recipes;
create policy "Innloggede kan slette egne oppskrifter"
  on recipes for delete
  to authenticated
  using (owner_id = auth.uid());

-- Profiler: ett fornavn/kallenavn per familiemedlem, til visning i UI-et i
-- stedet for e-postadressen. Fylles inn manuelt av deg via SQL Editor når du
-- oppretter en ny bruker - se README for fremgangsmåte.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
);

alter table profiles enable row level security;

-- Alle (også ikke-innloggede) kan lese profiler, siden navnene skal vises i UI-et.
drop policy if exists "Alle kan lese profiler" on profiles;
create policy "Alle kan lese profiler"
  on profiles for select
  to anon, authenticated
  using (true);

-- Bucket for oppskriftsbilder. Kjør i tillegg (eller opprett bucket i UI):
-- Storage -> New bucket -> navn: recipe-images -> Public bucket: PÅ
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

drop policy if exists "Alle kan se oppskriftsbilder" on storage.objects;
create policy "Alle kan se oppskriftsbilder"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'recipe-images');

drop policy if exists "Innloggede kan laste opp oppskriftsbilder" on storage.objects;
create policy "Innloggede kan laste opp oppskriftsbilder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipe-images');
