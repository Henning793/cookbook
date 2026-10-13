-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_handleliste.sql. Trygt å kjøre på nytt (idempotent).

-- Antall porsjoner for en dag i ukesmenyen, f.eks. når man har gjester.
-- NULL = oppskriftens eget antall (recipes.servings). Handlelisten ganger
-- mengdene med servings / recipes.servings for den dagen.
alter table menu_days add column if not exists servings numeric check (servings > 0);
