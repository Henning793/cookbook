-- Kokeboka — teknikker (f.eks. sous-vide, basilikumkaviar).
-- Kjør i Supabase Dashboard -> SQL Editor -> New query.
-- Trygt å kjøre på nytt (idempotent), i samme stil som supabase/schema.sql.
--
-- En teknikk er en rad i recipes med kind = 'technique', så deling, bilder,
-- kokemodus og tidtakere virker uten egne tabeller. Alle eksisterende rader
-- får 'recipe' og oppfører seg som før.

alter table recipes add column if not exists kind text not null default 'recipe';

alter table recipes drop constraint if exists recipes_kind_check;
alter table recipes add constraint recipes_kind_check check (kind in ('recipe', 'technique'));
