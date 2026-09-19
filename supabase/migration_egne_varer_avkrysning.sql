-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_handleliste.sql. Trygt å kjøre på nytt (idempotent).

-- Egne varer kan nå krysses av (dempes og blir stående) på samme måte som
-- ingredienser fra oppskrifter, og fjernes først med "Tøm huket av".
alter table manual_shopping_items add column if not exists checked boolean not null default false;
