-- Manual reversion for 0013_generation_fingerprints.sql (drizzle-kit has
-- no `down` command; apply by hand with psql or the Supabase SQL editor).
-- Only the remembered paragraph fingerprints are lost: the next "Generar"
-- of each technique then sends the whole page again (as a page generated
-- before 0013 does). No generated item is touched.
drop table if exists generation_fingerprints;
