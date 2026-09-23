-- Manual reversal for 0006_page_pdfs_storage.sql (drizzle-kit has no `down`
-- command). Run it as ONE transaction: `psql --single-transaction -f`, or
-- paste it whole into the Supabase SQL editor (one multi-statement query is
-- one transaction). `set local` below only lasts for that transaction.
-- Unlike 0004's reversal, this deletes the bucket and every PDF in it: the
-- PDFs are only import inputs, and the imported content already lives in
-- pages.content. page-assets and its policies are not touched.
drop policy if exists "page-pdfs read own" on storage.objects;
drop policy if exists "page-pdfs write own" on storage.objects;
drop policy if exists "page-pdfs delete own" on storage.objects;
-- Supabase's storage.protect_delete trigger rejects direct deletes from
-- storage tables unless this setting is 'true'.
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'page-pdfs';
delete from storage.buckets where id = 'page-pdfs';
