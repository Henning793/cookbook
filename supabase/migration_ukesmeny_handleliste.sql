-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- schema.sql, migration_recipe_header_fields.sql og migration_family_groups.sql.
-- Trygt å kjøre på nytt (idempotent).

-- =========================================================================
-- Tabeller
-- =========================================================================

create table if not exists menu_days (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),      -- NULL = personlig
  owner_id uuid not null references auth.users(id) default auth.uid(),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = mandag ... 6 = søndag
  entry_type text check (entry_type in ('recipe', 'freetext')),
  recipe_id uuid references recipes(id) on delete set null,
  freetext text,
  updated_at timestamptz not null default now(),
  constraint menu_days_entry_matches_type check (
    (entry_type = 'recipe' and recipe_id is not null and freetext is null)
    or (entry_type = 'freetext' and freetext is not null and trim(freetext) <> '' and recipe_id is null)
    or (entry_type is null and recipe_id is null and freetext is null)
  )
);

-- Maks én rad per ukedag innenfor samme familie, og maks én rad per ukedag
-- per person når family_id er NULL - speiler collections sine to partielle
-- unike indekser (se migration_family_groups.sql).
create unique index if not exists menu_days_family_weekday_key
  on menu_days (family_id, weekday) where family_id is not null;

create unique index if not exists menu_days_personal_owner_weekday_key
  on menu_days (owner_id, weekday) where family_id is null;

create table if not exists shopping_checked_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),      -- NULL = personlig
  owner_id uuid not null references auth.users(id) default auth.uid(),
  normalized_name text not null,   -- trim + lowercase av ingrediensnavnet
  unit text not null,
  checked_at timestamptz not null default now()
);

create unique index if not exists shopping_checked_family_key
  on shopping_checked_items (family_id, normalized_name, unit) where family_id is not null;

create unique index if not exists shopping_checked_personal_key
  on shopping_checked_items (owner_id, normalized_name, unit) where family_id is null;

create table if not exists manual_shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),      -- NULL = personlig
  owner_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- RLS - speiler collections-policyene (samme åpenhet: alle familiemedlemmer
-- kan lese/opprette/endre/slette, ingen admin-kun-begrensning; personlige
-- rader er scopet på owner_id, kun synlig/redigerbart for den brukeren).
-- =========================================================================

alter table menu_days enable row level security;
alter table shopping_checked_items enable row level security;
alter table manual_shopping_items enable row level security;

drop policy if exists "Familie eller eier kan se menu_days" on menu_days;
create policy "Familie eller eier kan se menu_days"
  on menu_days for select
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier administrerer menu_days" on menu_days;
create policy "Familie eller eier administrerer menu_days"
  on menu_days for all
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  )
  with check (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier kan se shopping_checked_items" on shopping_checked_items;
create policy "Familie eller eier kan se shopping_checked_items"
  on shopping_checked_items for select
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier administrerer shopping_checked_items" on shopping_checked_items;
create policy "Familie eller eier administrerer shopping_checked_items"
  on shopping_checked_items for all
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  )
  with check (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier kan se manual_shopping_items" on manual_shopping_items;
create policy "Familie eller eier kan se manual_shopping_items"
  on manual_shopping_items for select
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );

drop policy if exists "Familie eller eier administrerer manual_shopping_items" on manual_shopping_items;
create policy "Familie eller eier administrerer manual_shopping_items"
  on manual_shopping_items for all
  to authenticated
  using (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  )
  with check (
    (family_id is null and owner_id = auth.uid())
    or family_id in (select family_id from family_members where user_id = auth.uid())
  );
