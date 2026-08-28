-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  ingredients text not null,
  steps text not null,
  image_url text
);

alter table recipes enable row level security;

-- Alle (også ikke-innloggede) kan lese oppskrifter, siden de skal deles med andre.
create policy "Alle kan lese oppskrifter"
  on recipes for select
  to anon, authenticated
  using (true);

-- Kun innloggede brukere kan legge til oppskrifter.
create policy "Innloggede kan legge til oppskrifter"
  on recipes for insert
  to authenticated
  with check (true);

-- (Valgfritt) la innloggede også oppdatere/slette oppskrifter.
create policy "Innloggede kan endre oppskrifter"
  on recipes for update
  to authenticated
  using (true);

create policy "Innloggede kan slette oppskrifter"
  on recipes for delete
  to authenticated
  using (true);

-- Bucket for oppskriftsbilder. Kjør i tillegg (eller opprett bucket i UI):
-- Storage -> New bucket -> navn: recipe-images -> Public bucket: PÅ
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "Alle kan se oppskriftsbilder"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'recipe-images');

create policy "Innloggede kan laste opp oppskriftsbilder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipe-images');
