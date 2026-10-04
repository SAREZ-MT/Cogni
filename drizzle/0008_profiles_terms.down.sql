-- Manual reversion for 0008_profiles_terms.sql (drizzle-kit has no `down`
-- command; apply by hand with psql or the Supabase SQL editor).
-- Every recorded terms acceptance is lost; accounts are asked again.
alter table profiles drop column if exists terms_accepted_at;
alter table profiles drop column if exists terms_accepted_version;
