-- Oppskrift fra bilde: dagsgrense per bruker. Trygt å kjøre på nytt (idempotent).
--
-- Flyt: appen sender bilder til edge-funksjonen recipe-from-image, som
-- reserverer plass i dagens kvote her før den sender bildene til Claude.
-- API-nøkkelen ligger som secret på edge-funksjonen (ANTHROPIC_API_KEY)
-- og er IKKE med her:
--   Supabase-dashbordet -> Edge Functions -> Secrets -> ANTHROPIC_API_KEY

-- Antall bilder hver bruker har sendt per dag (norsk dato).
create table if not exists recipe_scan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  images integer not null default 0,
  primary key (user_id, day)
);

-- Ingen policyer: bare edge-funksjonen (service_role) leser og skriver.
alter table recipe_scan_usage enable row level security;

-- Reserverer p_images bilder i dagens kvote. Returnerer hvor mange som er
-- igjen etterpå, eller -1 hvis grensen ville blitt passert (da reserveres
-- ingenting). Ett atomisk kall, så to samtidige forespørsler ikke kan
-- snike seg forbi grensen.
create or replace function public.claim_recipe_scan_quota(p_user_id uuid, p_images integer, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Europe/Oslo')::date;
  v_used integer;
begin
  if p_images < 1 or p_images > p_limit then
    return -1;
  end if;

  delete from public.recipe_scan_usage where day < v_day - 30;

  insert into public.recipe_scan_usage as usage (user_id, day, images)
  values (p_user_id, v_day, p_images)
  on conflict (user_id, day) do update
    set images = usage.images + excluded.images
    where usage.images + excluded.images <= p_limit
  returning usage.images into v_used;

  if v_used is null then
    return -1;
  end if;
  return p_limit - v_used;
end;
$$;

-- Gir kvoten tilbake når tolkingen feilet uten at brukeren fikk noe svar.
create or replace function public.refund_recipe_scan_quota(p_user_id uuid, p_images integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.recipe_scan_usage
  set images = greatest(0, images - p_images)
  where user_id = p_user_id
    and day = (now() at time zone 'Europe/Oslo')::date;
$$;

revoke all on function public.claim_recipe_scan_quota(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_recipe_scan_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_recipe_scan_quota(uuid, integer, integer) to service_role;
grant execute on function public.refund_recipe_scan_quota(uuid, integer) to service_role;
