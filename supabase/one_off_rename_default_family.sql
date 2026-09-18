-- Engangsrettelse, IKKE en del av det generelle oppsettet i
-- schema.sql/migration_family_groups.sql: familiegrupper-migreringen
-- oppretter en "Default-familie" som samler alle eksisterende brukere og
-- oppskrifter ved første kjøring (se migration_family_groups.sql). Dette
-- er kun en generisk plassholder-navn ved migrering - hvert nettsted som
-- kjører migreringen bør selv gi sin egen default-familie et passende navn
-- etterpå, slik denne filen gjør for dette nettstedet.
--
-- Kjør i Supabase Dashboard -> SQL Editor. Trygt å kjøre på nytt (no-op
-- andre gang, siden det da ikke finnes noen familie med navnet
-- "Default-familie" igjen å endre).
update families
set name = 'Myhre Kvaløy'
where name = 'Default-familie';
