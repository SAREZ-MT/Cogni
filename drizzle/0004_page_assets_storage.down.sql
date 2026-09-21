-- Manual reversal for 0004_page_assets_storage.sql.
-- drizzle-kit has no `down`/rollback command: it only applies migrations
-- forward in journal order. This file is not run by `pnpm db:migrate` or
-- any tooling; apply it by hand (psql or the Supabase SQL editor) against
-- the target database if this migration needs to be rolled back.
-- This only drops the two policies and resets the bucket's limits; it does
-- NOT delete the bucket itself or any objects already uploaded to it.
drop policy if exists "page-assets write own" on storage.objects;
drop policy if exists "page-assets read own" on storage.objects;
update storage.buckets
set file_size_limit = null, allowed_mime_types = null
where id = 'page-assets';
