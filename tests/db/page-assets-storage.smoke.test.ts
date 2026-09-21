import postgres from "postgres";
import { describe, expect, it } from "vitest";

// Guards 0004_page_assets_storage.sql: the `page-assets` bucket exists with
// the exact limits from design.md, and both RLS policies exist on
// storage.objects. Scenario "Bucket privado con RLS por propietario",
// specs/page-assets/spec.md.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("0004 page-assets storage bucket and RLS", () => {
  it("creates the page-assets bucket with the documented limits", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      const [bucket] = await sql`
        select id, public, file_size_limit, allowed_mime_types
        from storage.buckets
        where id = 'page-assets'
      `;
      expect(bucket).toBeDefined();
      expect(bucket.public).toBe(false);
      expect(Number(bucket.file_size_limit)).toBe(10485760);
      expect(bucket.allowed_mime_types).toEqual([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ]);
    } finally {
      await sql.end();
    }
  });

  it("defines the owner-scoped read and write RLS policies", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      const policies = await sql`
        select policyname, cmd
        from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname in ('page-assets read own', 'page-assets write own')
      `;
      const names = policies.map((p) => p.policyname).sort();
      expect(names).toEqual(["page-assets read own", "page-assets write own"]);
    } finally {
      await sql.end();
    }
  });
});
