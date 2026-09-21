-- Manual reversal for 0002_profiles_auth_fk.sql.
-- drizzle-kit has no `down`/rollback command: it only applies migrations
-- forward in journal order. This file is not run by `pnpm db:migrate` or
-- any tooling; apply it by hand (psql or the Supabase SQL editor) against
-- the target database if this migration needs to be rolled back.
-- This only drops the constraint. The orphan `profiles` rows deleted by
-- the up migration are NOT restored — that delete is not reversible.
alter table profiles drop constraint profiles_id_fkey;
