-- Bucket configuration and RLS policies for imported PDFs (design.md,
-- "Bucket privado `page-pdfs` por migración, con lectura, escritura y
-- borrado propios"). Same pattern as 0004_page_assets_storage.sql: raw SQL,
-- because Drizzle does not introspect the `storage` schema. page-assets is
-- not touched.
--
-- Idempotent bucket upsert: `on conflict` keeps this migration the single
-- source of truth for the limits in cogni-dev and cogni-prod, even if the
-- bucket was created by hand before.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-pdfs', 'page-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint
-- The first path segment of an object's name is the owner id
-- (`{ownerId}/{uploadId}.pdf`); RLS filters on it via
-- storage.foldername(name), the documented Supabase Storage pattern.
create policy "page-pdfs read own"
  on storage.objects for select
  using (bucket_id = 'page-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
--> statement-breakpoint
create policy "page-pdfs write own"
  on storage.objects for insert
  with check (bucket_id = 'page-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
--> statement-breakpoint
create policy "page-pdfs delete own"
  on storage.objects for delete
  using (bucket_id = 'page-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
