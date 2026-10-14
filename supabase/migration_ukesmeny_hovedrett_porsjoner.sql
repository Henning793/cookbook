-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_flere_retter.sql. Trygt å kjøre på nytt (idempotent).

-- Eget antall for hovedretten (recipe_id) på en dag med flere retter, slik
-- de andre rettene har i extra_dishes. NULL = følger dagens antall (servings).
alter table menu_days add column if not exists main_servings integer;
