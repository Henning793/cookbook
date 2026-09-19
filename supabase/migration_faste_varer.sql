-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_handleliste.sql. Trygt å kjøre på nytt (idempotent).

-- Faste varer: 'always_home' = varer man alltid har hjemme (skjules fra
-- "Fra ukens retter"), 'weekly' = faste kjøp (legges i Egne varer når man
-- oppretter ny ukesmeny). Samme family_id/owner_id-scoping som collections.
create table if not exists standing_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),      -- NULL = personlig
  owner_id uuid not null references auth.users(id) default auth.uid(),
  kind text not null check (kind in ('always_home', 'weekly')),
  name text not null,
  normalized_name text not null,               -- trim + lowercase
  created_at timestamptz not null default now()
);

create unique index if not exists standing_items_family_key
  on standing_items (family_id, kind, normalized_name) where family_id is not null;

create unique index if not exists standing_items_personal_key
  on standing_items (owner_id, kind, normalized_name) where family_id is null;

alter table standing_items enable row level security;

drop policy if exists "Familie eller eier kan se standing_items" on standing_items;
create policy "Familie eller eier kan se standing_items"
  on standing_items for select
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier administrerer standing_items" on standing_items;
create policy "Familie eller eier administrerer standing_items"
  on standing_items for all
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  )
  with check (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );
