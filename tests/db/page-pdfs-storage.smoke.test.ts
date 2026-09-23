import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { ForceRollback, readDownSql } from "./helpers/rollback";

// Guards drizzle/0006_page_pdfs_storage.sql (+ .down.sql): the private
// `page-pdfs` bucket exists with the limits from design.md and the three
// owner-scoped policies exist on storage.objects. Scenario "Migración del
// bucket aplicada y revertida", specs/pdf-import/spec.md.
const url = process.env.DATABASE_URL;

const PDF_POLICIES = [
  "page-pdfs delete own",
  "page-pdfs read own",
  "page-pdfs write own",
];
const ASSET_POLICIES = ["page-assets read own", "page-assets write own"];

async function policiesOf(
  sql: postgres.Sql | postgres.TransactionSql,
  bucketPrefix: string,
) {
  return sql`
    select policyname, cmd
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like ${`${bucketPrefix} %`}
    order by policyname
  `;
}

describe.skipIf(!url)("0006 page-pdfs storage bucket and RLS", () => {
  it("creates the private page-pdfs bucket with the documented limits", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      const [bucket] = await sql`
        select public, file_size_limit, allowed_mime_types
        from storage.buckets
        where id = 'page-pdfs'
      `;
      expect(bucket?.public).toBe(false);
      // 20 MiB — same literal as drizzle/0006_page_pdfs_storage.sql's
      // bucket upsert and domain/pdf-file.ts's MAX_PDF_BYTES (T1
      // follow-up: R2-magic-size-limit).
      expect(Number(bucket?.file_size_limit)).toBe(20971520);
      expect(bucket?.allowed_mime_types).toEqual(["application/pdf"]);
    } finally {
      await sql.end();
    }
  });

  it("defines the owner-scoped read, write and delete policies", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      const policies = await policiesOf(sql, "page-pdfs");
      expect(policies.map((p) => [p.policyname, p.cmd])).toEqual([
        ["page-pdfs delete own", "DELETE"],
        ["page-pdfs read own", "SELECT"],
        ["page-pdfs write own", "INSERT"],
      ]);
    } finally {
      await sql.end();
    }
  });

  // T1 follow-up: R3-storage-rls-existence-only — the previous test only
  // proved the three policies exist, not that they actually scope access
  // to the caller's own folder. Reads pg_policies.qual (the USING clause,
  // for read/delete) and with_check (for insert) and asserts each
  // predicate both pins bucket_id to 'page-pdfs' and compares the first
  // path segment to auth.uid(), the exact shape design.md documents
  // (`(storage.foldername(name))[1] = auth.uid()::text`).
  it("scopes every page-pdfs policy's predicate to bucket_id and the caller's own folder", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      const policies = await sql`
        select policyname, qual, with_check
        from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname like ${"page-pdfs %"}
        order by policyname
      `;
      expect(policies).toHaveLength(3);
      for (const policy of policies) {
        // read/delete carry their predicate in `qual` (the USING clause);
        // insert has no USING clause, only `with_check`.
        const predicate = policy.qual ?? policy.with_check;
        expect(predicate, `${policy.policyname} has no predicate`).toBeTruthy();
        expect(predicate).toContain("bucket_id");
        expect(predicate).toContain("page-pdfs");
        expect(predicate).toContain("foldername(name)");
        expect(predicate).toContain("auth.uid()");
      }
    } finally {
      await sql.end();
    }
  });

  it("reversion removes page-pdfs and keeps page-assets intact", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      await sql
        .begin(async (tx) => {
          await tx.unsafe(readDownSql("0006_page_pdfs_storage"));

          const buckets = await tx`
            select id from storage.buckets
            where id in ('page-pdfs', 'page-assets')
          `;
          expect(buckets.map((row) => row.id)).toEqual(["page-assets"]);
          expect(await policiesOf(tx, "page-pdfs")).toHaveLength(0);
          expect(
            (await policiesOf(tx, "page-assets")).map((p) => p.policyname),
          ).toEqual(ASSET_POLICIES);

          throw new ForceRollback();
        })
        .catch((error) => {
          if (!(error instanceof ForceRollback)) throw error;
        });

      const policies = await policiesOf(sql, "page-pdfs");
      expect(policies.map((p) => p.policyname)).toEqual(PDF_POLICIES);
    } finally {
      await sql.end();
    }
  });
});
