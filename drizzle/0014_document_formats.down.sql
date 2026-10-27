-- Manual reversion for 0014_document_formats.sql (drizzle-kit has no
-- `down` command; apply by hand with psql --single-transaction or the
-- Supabase SQL editor, then delete 0014's row from
-- drizzle.__drizzle_migrations so a later migrate reapplies it).
-- Only the format and skipped-images bookkeeping of import jobs is lost;
-- imported content already lives in pages.content. DOCX/PPTX objects
-- already in the bucket stay readable; new ones are refused again.
alter table "import_jobs" drop constraint if exists "import_jobs_skipped_images_check";
alter table "import_jobs" drop constraint if exists "import_jobs_format_check";
alter table "import_jobs" drop column if exists "skipped_images";
alter table "import_jobs" drop column if exists "format";
update storage.buckets
set allowed_mime_types = array['application/pdf']
where id = 'page-pdfs';
