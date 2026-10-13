-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_porsjoner.sql. Trygt å kjøre på nytt (idempotent).

-- Flere retter på samme dag i ukesmenyen, f.eks. hovedrett + saus.
-- recipe_id er fortsatt hovedretten, og servings er fortsatt antallet for
-- hele dagen («hvor mange spiser»). extra_dishes er resten av rettene i
-- rekkefølge: [{ "recipe_id": "...", "servings": null }]. servings NULL =
-- følger dagens antall, et tall = eget antall for den retten.
alter table menu_days add column if not exists extra_dishes jsonb not null default '[]'::jsonb;
