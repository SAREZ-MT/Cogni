-- Bucket configuration and RLS policies for Supabase Storage's
-- `storage.objects`/`storage.buckets` tables (design.md, "Bucket privado
-- `page-assets`, ruta canónica y RLS por `owner_id`"). Drizzle does not
-- introspect the `storage` schema (same reason as `auth.users` in
-- 0002_profiles_auth_fk.sql), so this is hand-written raw SQL applied by
-- `drizzle-kit migrate` like every other migration in this project.
--
-- Idempotent bucket upsert: the bucket may already exist from a manual
-- dashboard step (tasks.md 6.2), so `on conflict` keeps this migration the
-- single reproducible source of truth for `file_size_limit` and
-- `allowed_mime_types` across cogni-dev and cogni-prod.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'page-assets',
  'page-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint
-- The first path segment of an object's name is the owner id
-- (`{ownerId}/{pageId}/{assetId}.{ext}`); RLS filters on it via
-- storage.foldername(name), the documented Supabase Storage pattern.
create policy "page-assets read own"
  on storage.objects for select
  using (bucket_id = 'page-assets' and (storage.foldername(name))[1] = auth.uid()::text);
--> statement-breakpoint
create policy "page-assets write own"
  on storage.objects for insert
  with check (bucket_id = 'page-assets' and (storage.foldername(name))[1] = auth.uid()::text);
