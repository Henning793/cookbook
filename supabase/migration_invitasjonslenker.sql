-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_family_groups.sql.
-- Trygt å kjøre på nytt (idempotent). Legger bare til - ingenting fjernes.
--
-- Invitasjonslenker erstatter den faste familiekoden (families.invite_code)
-- i appen: en lenke man sender på f.eks. SMS, gyldig i 24 timer. Den gamle
-- kolonnen og join_family_by_code/start_family_share blir liggende inntil
-- videre, slik at en eldre versjon av appen fortsatt virker til alle har
-- oppdatert.

-- =========================================================================
-- Tabeller
-- =========================================================================

-- «Bli med i familien»-lenker. Kan brukes av flere til den utløper.
create table if not exists family_invites (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  family_id uuid not null references families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

-- Delingslenker for en oppskrift, en samling eller hele boken. Den som
-- åpner lenken og godtar, får en godkjent rad i family_shares.
create table if not exists share_links (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  from_family_id uuid not null references families(id) on delete cascade,
  share_type text not null check (share_type in ('recipe', 'collection', 'whole_family')),
  recipe_id uuid references recipes(id) on delete cascade,
  collection_id uuid references collections(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  constraint share_links_target_matches_type check (
    (share_type = 'recipe' and recipe_id is not null and collection_id is null)
    or (share_type = 'collection' and collection_id is not null and recipe_id is null)
    or (share_type = 'whole_family' and recipe_id is null and collection_id is null)
  )
);

-- Ingen policyer: tokenet er selve nøkkelen, så tabellene skal aldri kunne
-- leses eller skrives direkte fra klienten. Alt går via RPC-ene under.
alter table family_invites enable row level security;
alter table share_links enable row level security;

-- =========================================================================
-- Familieinvitasjon
-- =========================================================================

create or replace function create_family_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_token text;
begin
  select family_id into v_family_id from family_members where user_id = auth.uid();
  if v_family_id is null then
    raise exception 'Du må være medlem av en familie for å invitere.';
  end if;

  insert into family_invites (family_id, created_by)
  values (v_family_id, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

-- Det «Bli med i <familienavn>» viser, før man har blitt med. Ingen rad
-- betyr at lenken er ugyldig eller utløpt.
create or replace function family_invite_preview(p_token text)
returns table (
  family_id uuid,
  family_name text,
  invited_by text,
  member_count integer,
  already_member boolean,
  current_family_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    f.name,
    p.display_name,
    (select count(*)::integer from family_members m where m.family_id = f.id),
    exists (select 1 from family_members m where m.family_id = f.id and m.user_id = auth.uid()),
    (
      select cf.name from family_members cm
      join families cf on cf.id = cm.family_id
      where cm.user_id = auth.uid() and cm.family_id <> f.id
    )
  from family_invites i
  join families f on f.id = i.family_id
  left join profiles p on p.id = i.created_by
  where i.token = p_token and i.expires_at > now() and auth.uid() is not null;
$$;

create or replace function join_family_by_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Du må være innlogget.';
  end if;

  select family_id into v_family_id from family_invites
  where token = p_token and expires_at > now();
  if v_family_id is null then
    raise exception 'Invitasjonslenken er utløpt. Be om en ny lenke.' using hint = 'invalid_token';
  end if;

  if exists (select 1 from family_members where user_id = auth.uid() and family_id = v_family_id) then
    return v_family_id;
  end if;

  if exists (select 1 from family_members where user_id = auth.uid()) then
    raise exception 'Du er allerede medlem av en familie. Forlat den først.';
  end if;

  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'member');

  -- Personlige oppskrifter (uten familie fra før) blir med inn i familien
  -- man blir medlem av - samme oppførsel som join_family_by_code.
  update recipes set family_id = v_family_id where owner_id = auth.uid() and family_id is null;

  return v_family_id;
end;
$$;

-- =========================================================================
-- Delingslenke
-- =========================================================================

create or replace function create_share_link(
  p_share_type text,
  p_recipe_id uuid,
  p_collection_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_family_id uuid;
  v_token text;
begin
  select family_id into v_from_family_id from family_members where user_id = auth.uid();
  if v_from_family_id is null then
    raise exception 'Du må være medlem av en familie for å dele.';
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

  insert into share_links (from_family_id, share_type, recipe_id, collection_id, created_by)
  values (v_from_family_id, p_share_type, p_recipe_id, p_collection_id, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

-- Det «Godta»-siden viser. Ingen rad betyr at lenken er ugyldig eller utløpt.
create or replace function share_link_preview(p_token text)
returns table (
  share_type text,
  recipe_id uuid,
  collection_id uuid,
  title text,
  from_family_name text,
  shared_by text,
  has_family boolean,
  own_family boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.share_type,
    l.recipe_id,
    l.collection_id,
    coalesce(r.title, c.name),
    f.name,
    p.display_name,
    exists (select 1 from family_members m where m.user_id = auth.uid()),
    exists (select 1 from family_members m where m.user_id = auth.uid() and m.family_id = l.from_family_id)
  from share_links l
  join families f on f.id = l.from_family_id
  left join recipes r on r.id = l.recipe_id
  left join collections c on c.id = l.collection_id
  left join profiles p on p.id = l.created_by
  where l.token = p_token and l.expires_at > now() and auth.uid() is not null;
$$;

-- Godtar delingen på vegne av egen familie. Alle medlemmer kan godta (ikke
-- bare admin, som i den gamle kodebaserte flyten) - den som fikk lenken er
-- den avsenderen ville dele med.
create or replace function accept_share_link(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link share_links%rowtype;
  v_to_family_id uuid;
  v_share_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Du må være innlogget.';
  end if;

  select * into v_link from share_links where token = p_token and expires_at > now();
  if not found then
    raise exception 'Delingslenken er utløpt. Be om en ny lenke.' using hint = 'invalid_token';
  end if;

  select family_id into v_to_family_id from family_members where user_id = auth.uid();
  if v_to_family_id is null then
    raise exception 'Du må være medlem av en familie for å ta imot en deling.' using hint = 'no_family';
  end if;

  if v_to_family_id = v_link.from_family_id then
    raise exception 'Dette er allerede en del av din egen familie.' using hint = 'own_family';
  end if;

  -- Finnes det allerede en aktiv deling av det samme mellom de samme
  -- familiene, gjenbrukes den i stedet for å lage en duplikat.
  select id into v_share_id from family_shares
  where from_family_id = v_link.from_family_id
    and to_family_id = v_to_family_id
    and share_type = v_link.share_type
    and recipe_id is not distinct from v_link.recipe_id
    and collection_id is not distinct from v_link.collection_id
    and status in ('pending', 'accepted')
  order by created_at
  limit 1;

  if v_share_id is not null then
    update family_shares set status = 'accepted', responded_at = now()
    where id = v_share_id and status = 'pending';
    return v_share_id;
  end if;

  insert into family_shares (
    from_family_id, to_family_id, share_type, recipe_id, collection_id, status, responded_at
  )
  values (
    v_link.from_family_id, v_to_family_id, v_link.share_type, v_link.recipe_id, v_link.collection_id,
    'accepted', now()
  )
  returning id into v_share_id;

  return v_share_id;
end;
$$;

-- Mottakerfamilien fjerner noe som er delt med den («Delt med oss» på
-- familiesiden). Alle medlemmer kan fjerne, på samme måte som alle kan
-- godta. Avsenderen bruker fortsatt revoke_family_share.
create or replace function remove_incoming_family_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_family_id uuid;
begin
  select to_family_id into v_to_family_id from family_shares where id = p_share_id;
  if v_to_family_id is null or not exists (
    select 1 from family_members where family_id = v_to_family_id and user_id = auth.uid()
  ) then
    raise exception 'Kun mottakerfamilien kan fjerne en deling.';
  end if;

  update family_shares set status = 'rejected', responded_at = now()
  where id = p_share_id and status in ('pending', 'accepted');
end;
$$;

-- Funksjonene skal bare kunne kalles av innloggede brukere.
revoke execute on function
  create_family_invite(), family_invite_preview(text), join_family_by_invite(text),
  create_share_link(text, uuid, uuid), share_link_preview(text), accept_share_link(text),
  remove_incoming_family_share(uuid)
from public, anon;
grant execute on function
  create_family_invite(), family_invite_preview(text), join_family_by_invite(text),
  create_share_link(text, uuid, uuid), share_link_preview(text), accept_share_link(text),
  remove_incoming_family_share(uuid)
to authenticated;
