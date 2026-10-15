-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_handleliste.sql. Trygt å kjøre på nytt (idempotent).

-- Redigering av varer fra ukens retter på handlelisten. Varene regnes ut
-- live fra ukesmenyen, så en endring lagres som en overstyring på samme
-- nøkkel som avkryssingen (normalisert navn + enhet). Overstyringen blir
-- stående selv om listen regnes om (f.eks. når en rett legges til), og
-- slettes ved ny ukesmeny sammen med avkryssingene. NULL i name/amount_text
-- betyr "bruk det utregnede".
create table if not exists shopping_item_overrides (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),      -- NULL = personlig
  owner_id uuid not null references auth.users(id) default auth.uid(),
  normalized_name text not null,   -- nøkkelen til den utregnede varen
  unit text not null,
  name text,
  amount_text text,
  updated_at timestamptz not null default now()
);

create unique index if not exists shopping_overrides_family_key
  on shopping_item_overrides (family_id, normalized_name, unit) where family_id is not null;

create unique index if not exists shopping_overrides_personal_key
  on shopping_item_overrides (owner_id, normalized_name, unit) where family_id is null;

alter table shopping_item_overrides enable row level security;

drop policy if exists "Familie eller eier kan se shopping_item_overrides" on shopping_item_overrides;
create policy "Familie eller eier kan se shopping_item_overrides"
  on shopping_item_overrides for select
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier administrerer shopping_item_overrides" on shopping_item_overrides;
create policy "Familie eller eier administrerer shopping_item_overrides"
  on shopping_item_overrides for all
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  )
  with check (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );
