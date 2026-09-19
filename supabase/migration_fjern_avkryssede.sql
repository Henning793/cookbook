-- Kjør dette i Supabase Dashboard -> SQL Editor -> New query, ETTER
-- migration_ukesmeny_handleliste.sql. Trygt å kjøre på nytt (idempotent).

-- "Fjern avkryssede" på handlelisten skjuler avkryssede oppskrift-ingredienser
-- (de regnes ut live fra ukesmenyen og kan ikke slettes). Raden blir liggende
-- med cleared = true, og slettes sammen med resten ved ny ukesmeny.
alter table shopping_checked_items add column if not exists cleared boolean not null default false;
