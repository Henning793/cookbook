-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_family_groups.sql og migration_invitasjonslenker.sql.
-- Trygt å kjøre på nytt (idempotent).
--
-- Appen sier nå «gruppe» der den før sa «familie». Denne filen bytter bare
-- ordet i feilmeldingene som databasefunksjonene viser til brukeren.
-- Funksjonene er ellers uendret (kopiert fra de to filene over), og
-- tabell-, kolonne- og funksjonsnavn heter fortsatt family_*.

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
    raise exception 'Du er allerede medlem av en gruppe.';
  end if;

  insert into families (name, invite_code)
  values (trim(p_name), substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  returning id into v_family_id;

  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'admin');

  -- Personlige oppskrifter (uten familie fra før) blir med inn i den nye
  -- familien, slik at alle medlemmer av familien kan se dem - matcher
  -- join_family_by_code sin tilsvarende oppførsel under.
  update recipes set family_id = v_family_id where owner_id = auth.uid() and family_id is null;

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
    raise exception 'Du er allerede medlem av en gruppe. Forlat den først.';
  end if;

  select id into v_family_id from families where invite_code = trim(p_code);
  if v_family_id is null then
    raise exception 'Fant ingen gruppe med denne koden.';
  end if;

  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'member');

  -- Personlige oppskrifter (uten familie fra før) blir med inn i familien
  -- man blir medlem av, slik at alle medlemmer kan se dem.
  update recipes set family_id = v_family_id where owner_id = auth.uid() and family_id is null;

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
    raise exception 'Du er den eneste admin i gruppen. Fjern de andre medlemmene, eller be en admin overta, før du forlater.';
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
    raise exception 'Kan ikke fjerne den eneste admin mens gruppen har andre medlemmer.';
  end if;

  delete from family_members where family_id = p_family_id and user_id = p_user_id;
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
    raise exception 'Du må være medlem av en gruppe for å dele.';
  end if;

  select id into v_to_family_id from families where invite_code = trim(p_code);
  if v_to_family_id is null then
    raise exception 'Fant ingen gruppe med denne koden.';
  end if;

  if v_to_family_id = v_from_family_id then
    raise exception 'Kan ikke dele med sin egen gruppe.';
  end if;

  if p_share_type = 'recipe' and not exists (
    select 1 from recipes where id = p_recipe_id and family_id = v_from_family_id
  ) then
    raise exception 'Oppskriften tilhører ikke din gruppe.';
  end if;

  if p_share_type = 'collection' and not exists (
    select 1 from collections where id = p_collection_id and family_id = v_from_family_id
  ) then
    raise exception 'Samlingen tilhører ikke din gruppe.';
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
    raise exception 'Kun admin i mottakergruppen kan godta eller avslå.';
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
    raise exception 'Kun avsendergruppen kan trekke tilbake en deling.';
  end if;

  update family_shares set status = 'revoked', responded_at = now() where id = p_share_id;
end;
$$;

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
    raise exception 'Du må være medlem av en gruppe for å invitere.';
  end if;

  insert into family_invites (family_id, created_by)
  values (v_family_id, auth.uid())
  returning token into v_token;

  return v_token;
end;
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
    raise exception 'Du er allerede medlem av en gruppe. Forlat den først.';
  end if;

  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'member');

  -- Personlige oppskrifter (uten familie fra før) blir med inn i familien
  -- man blir medlem av - samme oppførsel som join_family_by_code.
  update recipes set family_id = v_family_id where owner_id = auth.uid() and family_id is null;

  return v_family_id;
end;
$$;

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
    raise exception 'Du må være medlem av en gruppe for å dele.';
  end if;

  if p_share_type = 'recipe' and not exists (
    select 1 from recipes where id = p_recipe_id and family_id = v_from_family_id
  ) then
    raise exception 'Oppskriften tilhører ikke din gruppe.';
  end if;

  if p_share_type = 'collection' and not exists (
    select 1 from collections where id = p_collection_id and family_id = v_from_family_id
  ) then
    raise exception 'Samlingen tilhører ikke din gruppe.';
  end if;

  insert into share_links (from_family_id, share_type, recipe_id, collection_id, created_by)
  values (v_from_family_id, p_share_type, p_recipe_id, p_collection_id, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

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
    raise exception 'Du må være medlem av en gruppe for å ta imot en deling.' using hint = 'no_family';
  end if;

  if v_to_family_id = v_link.from_family_id then
    raise exception 'Dette er allerede en del av din egen gruppe.' using hint = 'own_family';
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
    raise exception 'Kun mottakergruppen kan fjerne en deling.';
  end if;

  update family_shares set status = 'rejected', responded_at = now()
  where id = p_share_id and status in ('pending', 'accepted');
end;
$$;
