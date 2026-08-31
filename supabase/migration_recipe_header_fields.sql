-- Kokeboka — valgfrie felt i oppskriftshodet (beskrivelse, tid, porsjoner).
-- Kjør i Supabase Dashboard -> SQL Editor -> New query.
-- Trygt å kjøre på nytt (idempotent), i samme stil som supabase/schema.sql.
--
-- NB: dette er en egen, mindre fil enn design/handoff/migration_collections.sql
-- med hensikt - vi bruker det eksisterende tag-systemet (recipes.tags) for
-- "Samlinger" i stedet for handoff-ens foreslåtte collections/collection_recipes
-- -tabeller, så de opprettes ikke.

alter table recipes add column if not exists description text;
alter table recipes add column if not exists total_minutes int;
alter table recipes add column if not exists servings int;
