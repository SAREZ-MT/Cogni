-- Manual reversion for 0005_import_jobs.sql (drizzle-kit has no `down`
-- command; apply by hand with psql or the Supabase SQL editor). No other
-- table references import_jobs, so dropping it touches nothing else.
-- Import job rows are lost; imported content already lives in pages.content.
drop table if exists import_jobs;
