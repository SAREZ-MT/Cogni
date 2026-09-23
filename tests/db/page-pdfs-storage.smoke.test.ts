import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

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

function readDownSql(): string {
  return readFileSync(
    path.join(process.cwd(), "drizzle", "0006_page_pdfs_storage.down.sql"),
    "utf8",
  );
}

class ForceRollback extends Error {}

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

  it("reversion removes page-pdfs and keeps page-assets intact", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      await sql
        .begin(async (tx) => {
          await tx.unsafe(readDownSql());

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
