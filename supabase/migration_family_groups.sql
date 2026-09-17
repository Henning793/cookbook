-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- schema.sql og migration_recipe_header_fields.sql.
-- Trygt å kjøre på nytt (idempotent).

-- =========================================================================
-- Tabeller
-- =========================================================================

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists family_members (
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- En bruker kan kun være medlem av én familie samtidig.
create unique index if not exists family_members_one_family_per_user
  on family_members (user_id);

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists collection_recipes (
  collection_id uuid not null references collections(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);

create table if not exists family_shares (
  id uuid primary key default gen_random_uuid(),
  from_family_id uuid not null references families(id) on delete cascade,
  to_family_id uuid not null references families(id) on delete cascade,
  share_type text not null check (share_type in ('recipe', 'collection', 'whole_family')),
  recipe_id uuid references recipes(id) on delete cascade,
  collection_id uuid references collections(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint family_shares_target_matches_type check (
    (share_type = 'recipe' and recipe_id is not null and collection_id is null)
    or (share_type = 'collection' and collection_id is not null and recipe_id is null)
    or (share_type = 'whole_family' and recipe_id is null and collection_id is null)
  ),
  constraint family_shares_no_self_share check (from_family_id <> to_family_id)
);

alter table recipes add column if not exists family_id uuid references families(id);

-- =========================================================================
-- Migrering av eksisterende data: samle alt i én default-familie
-- =========================================================================

-- NB: denne migreringen skal kun flytte inn brukere/oppskrifter som fantes
-- FØR familiegrupper-funksjonen fantes. Medlems-backfillen er derfor bare
-- trygg å kjøre ÉN gang, samtidig som selve Default-familien opprettes -
-- ikke hver gang denne SQL-filen kjøres på nytt (f.eks. ved en senere
-- rettelse i denne filen, som skjedde under manuell testing: en profil
-- opprettet etter første kjøring, men uten å ha logget inn og valgt
-- familie selv ennå, ville ellers blitt "sugd inn" i Default-familie ved
-- neste kjøring i stedet for å møte den tiltenkte onboarding-skjermen for
-- nye brukere).
do $$
declare
  v_default_family_id uuid;
begin
  select id into v_default_family_id from families where name = 'Default-familie';

  if v_default_family_id is null then
    insert into families (name, invite_code)
    values ('Default-familie', substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    returning id into v_default_family_id;

    -- Alle eksisterende brukere blir admin i default-familien - det finnes
    -- ingen naturlig måte å utpeke én bestemt admin retroaktivt, og likestilt
    -- adgang er tryggere enn å gjette. Kjøres kun her, inne i "opprett
    -- Default-familie for første gang"-grenen - se NB-kommentaren over.
    insert into family_members (family_id, user_id, role)
    select v_default_family_id, p.id, 'admin'
    from profiles p
    where not exists (select 1 from family_members fm where fm.user_id = p.id);

    update recipes set family_id = v_default_family_id where family_id is null;
  end if;
end $$;

-- =========================================================================
-- Trigger: nye oppskrifter får family_id fra innsetterens medlemskap
-- =========================================================================

create or replace function set_recipe_family_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.family_id is null then
    select family_id into new.family_id from family_members where user_id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_recipe_family_id on recipes;
create trigger trg_set_recipe_family_id
  before insert on recipes
  for each row execute function set_recipe_family_id();

-- =========================================================================
-- RPC-funksjoner (security definer - all skriving til families/
-- family_members/family_shares MÅ gå via disse, aldri direkte
-- insert/update/delete fra klienten, siden invariantene under (én familie
-- per bruker, kun admin kan godkjenne, atomisk accept) er vanskelige å
-- uttrykke trygt i rene RLS-policyer uten race conditions).
-- =========================================================================

create or replace function create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'Du er allerede medlem av en familie.';
  end if;

  insert into families (name, invite_code)
  values (trim(p_name), substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  returning id into v_family_id;

  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'admin');

  return v_family_id;
end;
$$;

create or replace function join_family_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'Du er allerede medlem av en familie. Forlat den først.';
  end if;

  select id into v_family_id from families where invite_code = trim(p_code);
  if v_family_id is null then
    raise exception 'Fant ingen familie med denne koden.';
  end if;

  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'member');

  return v_family_id;
end;
$$;

create or replace function leave_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_role text;
  v_admin_count int;
  v_member_count int;
begin
  select family_id, role into v_family_id, v_role from family_members where user_id = auth.uid();
  if v_family_id is null then
    return;
  end if;

  select count(*) into v_admin_count from family_members where family_id = v_family_id and role = 'admin';
  select count(*) into v_member_count from family_members where family_id = v_family_id;

  if v_role = 'admin' and v_admin_count = 1 and v_member_count > 1 then
    raise exception 'Du er den eneste admin i familien. Fjern de andre medlemmene, eller be en admin overta, før du forlater.';
  end if;

  delete from family_members where user_id = auth.uid();
end;
$$;

create or replace function remove_family_member(p_family_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_admin_count int;
  v_member_count int;
begin
  if not exists (
    select 1 from family_members
    where family_id = p_family_id and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Kun admin kan fjerne medlemmer.';
  end if;

  select role into v_target_role from family_members where family_id = p_family_id and user_id = p_user_id;
  select count(*) into v_admin_count from family_members where family_id = p_family_id and role = 'admin';
  select count(*) into v_member_count from family_members where family_id = p_family_id;

  if v_target_role = 'admin' and v_admin_count = 1 and v_member_count > 1 then
    raise exception 'Kan ikke fjerne den eneste admin mens familien har andre medlemmer.';
  end if;

  delete from family_members where family_id = p_family_id and user_id = p_user_id;
end;
$$;

create or replace function regenerate_family_code(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_code text;
begin
  if not exists (
    select 1 from family_members
    where family_id = p_family_id and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Kun admin kan generere ny kode.';
  end if;

  v_new_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  update families set invite_code = v_new_code where id = p_family_id;
  return v_new_code;
end;
$$;

create or replace function start_family_share(
  p_code text,
  p_share_type text,
  p_recipe_id uuid,
  p_collection_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_family_id uuid;
  v_to_family_id uuid;
  v_share_id uuid;
begin
  select family_id into v_from_family_id from family_members where user_id = auth.uid();
  if v_from_family_id is null then
    raise exception 'Du må være medlem av en familie for å dele.';
  end if;

  select id into v_to_family_id from families where invite_code = trim(p_code);
  if v_to_family_id is null then
    raise exception 'Fant ingen familie med denne koden.';
  end if;

  if v_to_family_id = v_from_family_id then
    raise exception 'Kan ikke dele med sin egen familie.';
  end if;

  if p_share_type = 'recipe' and not exists (
    select 1 from recipes where id = p_recipe_id and family_id = v_from_family_id
  ) then
    raise exception 'Oppskriften tilhører ikke din familie.';
  end if;

  if p_share_type = 'collection' and not exists (
    select 1 from collections where id = p_collection_id and family_id = v_from_family_id
  ) then
    raise exception 'Samlingen tilhører ikke din familie.';
  end if;

  insert into family_shares (from_family_id, to_family_id, share_type, recipe_id, collection_id)
  values (v_from_family_id, v_to_family_id, p_share_type, p_recipe_id, p_collection_id)
  returning id into v_share_id;

  return v_share_id;
end;
$$;

create or replace function respond_to_family_share(p_share_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_family_id uuid;
begin
  select to_family_id into v_to_family_id from family_shares where id = p_share_id and status = 'pending';
  if v_to_family_id is null then
    raise exception 'Fant ingen ventende delingsforespørsel.';
  end if;

  if not exists (
    select 1 from family_members
    where family_id = v_to_family_id and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Kun admin i mottakerfamilien kan godta eller avslå.';
  end if;

  update family_shares
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_at = now()
  where id = p_share_id and status = 'pending';

  if not found then
    raise exception 'Delingsforespørselen er allerede besvart.';
  end if;
end;
$$;

create or replace function revoke_family_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_family_id uuid;
begin
  select from_family_id into v_from_family_id from family_shares where id = p_share_id;
  if not exists (
    select 1 from family_members where family_id = v_from_family_id and user_id = auth.uid()
  ) then
    raise exception 'Kun avsenderfamilien kan trekke tilbake en deling.';
  end if;

  update family_shares set status = 'revoked', responded_at = now() where id = p_share_id;
end;
$$;

-- =========================================================================
-- RLS
-- =========================================================================

alter table families enable row level security;
alter table family_members enable row level security;
alter table collections enable row level security;
alter table collection_recipes enable row level security;
alter table family_shares enable row level security;

-- families/family_members: lesing av egen familie, samt av enhver familie
-- man har en delingsrelasjon med (i begge retninger, uansett status - dette
-- avslører kun navnet, ikke innhold, og at relasjonen finnes kan man
-- allerede se via family_shares-raden man har lov til å lese), ingen direkte
-- skriving (alt går via RPC-ene over, som er security definer og dermed
-- omgår RLS for sine egne interne writes).
drop policy if exists "Kan lese egen familie" on families;
create policy "Kan lese egen familie"
  on families for select
  to authenticated
  using (
    id in (select family_id from family_members where user_id = auth.uid())
    or id in (
      select from_family_id from family_shares
      where to_family_id in (select family_id from family_members where user_id = auth.uid())
    )
    or id in (
      select to_family_id from family_shares
      where from_family_id in (select family_id from family_members where user_id = auth.uid())
    )
  );

-- En policy på family_members kan ikke trygt subquery'e family_members
-- direkte i sin egen USING-klausul (funnet ved manuell testing mot en ekte
-- database: Postgres feiler med "infinite recursion detected in policy for
-- relation family_members", 42P17, fordi evaluering av policyen krever at
-- policyen evalueres på nytt for underspørringen). Løsningen er en egen
-- security definer-funksjon: den kjører som eier av databasen (superuser
-- ved migrering), som er unntatt fra RLS, og bryter dermed rekursjonen.
create or replace function my_family_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from family_members where user_id = auth.uid();
$$;

drop policy if exists "Kan lese medlemmer av egen familie" on family_members;
create policy "Kan lese medlemmer av egen familie"
  on family_members for select
  to authenticated
  using (family_id = my_family_id());

-- recipes: dropp den gamle globale policyen, innfør familie-scoping +
-- synlighet for godkjente delinger.
drop policy if exists "Alle kan lese oppskrifter" on recipes;
drop policy if exists "Familiemedlemmer kan se egne og delte oppskrifter" on recipes;
create policy "Familiemedlemmer kan se egne og delte oppskrifter"
  on recipes for select
  to authenticated
  using (
    family_id in (select family_id from family_members where user_id = auth.uid())
    or id in (
      select recipe_id from family_shares
      where status = 'accepted' and share_type = 'recipe'
        and to_family_id in (select family_id from family_members where user_id = auth.uid())
    )
    or id in (
      select cr.recipe_id from collection_recipes cr
      join family_shares fs on fs.collection_id = cr.collection_id
      where fs.status = 'accepted' and fs.share_type = 'collection'
        and fs.to_family_id in (select family_id from family_members where user_id = auth.uid())
    )
    or family_id in (
      select fs.from_family_id from family_shares fs
      where fs.status = 'accepted' and fs.share_type = 'whole_family'
        and fs.to_family_id in (select family_id from family_members where user_id = auth.uid())
    )
  );

-- Mirrors canEditRecipe in src/lib/recipePermissions.ts — keep both in sync.
drop policy if exists "Innloggede kan endre egne oppskrifter" on recipes;
create policy "Innloggede kan endre egne oppskrifter"
  on recipes for update
  to authenticated
  using (
    family_id in (select family_id from family_members where user_id = auth.uid())
    and (
      owner_id = auth.uid()
      or owner_id is null
      or owner_id not in (select user_id from family_members where family_id = recipes.family_id)
    )
  );

-- Mirrors canEditRecipe in src/lib/recipePermissions.ts — keep both in sync.
drop policy if exists "Innloggede kan slette egne oppskrifter" on recipes;
create policy "Innloggede kan slette egne oppskrifter"
  on recipes for delete
  to authenticated
  using (
    family_id in (select family_id from family_members where user_id = auth.uid())
    and (
      owner_id = auth.uid()
      or owner_id is null
      or owner_id not in (select user_id from family_members where family_id = recipes.family_id)
    )
  );

drop policy if exists "Innloggede kan legge til i egen kokebok" on recipes;
create policy "Innloggede kan legge til i egen kokebok"
  on recipes for insert
  to authenticated
  with check (owner_id = auth.uid() and (family_id is null or family_id in (select family_id from family_members where user_id = auth.uid())));

-- collections: alle i familien kan lese/opprette/endre/slette samlinger i
-- egen familie (samme åpenhet som tags har i dag), pluss lesing av
-- godkjente delte samlinger.
drop policy if exists "Familiemedlemmer kan se egne og delte samlinger" on collections;
create policy "Familiemedlemmer kan se egne og delte samlinger"
  on collections for select
  to authenticated
  using (
    family_id in (select family_id from family_members where user_id = auth.uid())
    or id in (
      select collection_id from family_shares
      where status = 'accepted' and share_type = 'collection'
        and to_family_id in (select family_id from family_members where user_id = auth.uid())
    )
    or family_id in (
      select fs.from_family_id from family_shares fs
      where fs.status = 'accepted' and fs.share_type = 'whole_family'
        and fs.to_family_id in (select family_id from family_members where user_id = auth.uid())
    )
  );

drop policy if exists "Familiemedlemmer administrerer egne samlinger" on collections;
create policy "Familiemedlemmer administrerer egne samlinger"
  on collections for all
  to authenticated
  using (family_id in (select family_id from family_members where user_id = auth.uid()))
  with check (family_id in (select family_id from family_members where user_id = auth.uid()));

drop policy if exists "Familiemedlemmer kan se collection_recipes" on collection_recipes;
create policy "Familiemedlemmer kan se collection_recipes"
  on collection_recipes for select
  to authenticated
  using (
    collection_id in (select id from collections)
  );

drop policy if exists "Familiemedlemmer administrerer collection_recipes" on collection_recipes;
create policy "Familiemedlemmer administrerer collection_recipes"
  on collection_recipes for all
  to authenticated
  using (
    collection_id in (
      select id from collections where family_id in (
        select family_id from family_members where user_id = auth.uid()
      )
    )
  )
  with check (
    collection_id in (
      select id from collections where family_id in (
        select family_id from family_members where user_id = auth.uid()
      )
    )
    and recipe_id in (select id from recipes where family_id in (select family_id from family_members where user_id = auth.uid()))
  );

-- family_shares: begge sider (avsender og mottaker) kan se raden, ingen
-- direkte insert/update/delete (alt går via RPC-ene over).
drop policy if exists "Begge sider av en deling kan se den" on family_shares;
create policy "Begge sider av en deling kan se den"
  on family_shares for select
  to authenticated
  using (
    from_family_id in (select family_id from family_members where user_id = auth.uid())
    or to_family_id in (select family_id from family_members where user_id = auth.uid())
  );
