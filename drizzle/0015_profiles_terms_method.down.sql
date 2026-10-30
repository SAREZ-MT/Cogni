-- Manual reversion for 0015_profiles_terms_method.sql (drizzle-kit has no
-- `down` command; apply by hand with psql or the Supabase SQL editor).
-- The recorded acceptance method (email / google / gate) is lost; the
-- accepted version and time in 0008's columns stay.
alter table profiles drop constraint if exists profiles_terms_accepted_method_check;
alter table profiles drop column if exists terms_accepted_method;
