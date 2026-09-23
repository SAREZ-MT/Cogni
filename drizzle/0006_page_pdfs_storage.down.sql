-- Manual reversal for 0006_page_pdfs_storage.sql (drizzle-kit has no `down`
-- command). Run it as ONE transaction: `psql --single-transaction -f`, or
-- paste it whole into the Supabase SQL editor (one multi-statement query is
-- one transaction). `set local` below only lasts for that transaction.
-- Unlike 0004's reversal, this table also held PDF import inputs; the
-- imported content already lives in pages.content, so no product data is
-- lost by reverting.
--
-- CAUTION (T1 follow-up: R4-down-orphans-storage-blobs): `delete from
-- storage.objects` below only removes the metadata ROWS Postgres tracks.
-- It does NOT free the underlying blob bytes in the storage backend
-- (S3-compatible object storage) — those are normally deleted together
-- with the row only when going through Supabase's Storage API, which this
-- raw SQL bypasses. Empty the `page-pdfs` bucket through the Storage API
-- (or the dashboard) BEFORE running this reversal, or accept that the PDF
-- blobs remain orphaned in storage after this migration reverts.
-- page-assets and its policies are not touched.
drop policy if exists "page-pdfs read own" on storage.objects;
drop policy if exists "page-pdfs write own" on storage.objects;
drop policy if exists "page-pdfs delete own" on storage.objects;
-- Supabase's storage.protect_delete trigger rejects direct deletes from
-- storage tables unless this setting is 'true'.
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'page-pdfs';
delete from storage.buckets where id = 'page-pdfs';
