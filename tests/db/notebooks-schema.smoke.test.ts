import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

// Guards drizzle/0003_notebooks_pages_assets.sql (+ .down.sql).
// Scenarios "Migracion aplicada" / "Migracion revertida",
// specs/notebooks/spec.md, Requirement "Modelo de datos segun S6.1".
const url = process.env.DATABASE_URL;

function readDownSql(migration: string): string {
  return readFileSync(
    path.join(process.cwd(), "drizzle", `${migration}.down.sql`),
    "utf8",
  );
}

// Reversions run newest first. import_jobs (0005) references pages, so it
// must be reverted before 0003 can drop the tables it depends on.
const REVERSIONS_DOWN_TO_0003 = [
  "0005_import_jobs",
  "0003_notebooks_pages_assets",
];

class ForceRollback extends Error {}

describe.skipIf(!url)("0003 notebooks/pages/page_assets schema", () => {
  it("creates the three tables with the declared columns and defaults", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      const tables = await sql`
        select table_name from information_schema.tables
        where table_schema = 'public'
          and table_name in ('notebooks', 'pages', 'page_assets')
        order by table_name
      `;
      expect(tables.map((row) => row.table_name)).toEqual([
        "notebooks",
        "page_assets",
        "pages",
      ]);

      const notebookColumns = await sql`
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'notebooks'
      `;
      expect(new Set(notebookColumns.map((row) => row.column_name))).toEqual(
        new Set([
          "id",
          "owner_id",
          "title",
          "icon",
          "color",
          "position",
          "archived_at",
          "created_at",
          "updated_at",
        ]),
      );

      const pageColumns = await sql`
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'pages'
      `;
      expect(new Set(pageColumns.map((row) => row.column_name))).toEqual(
        new Set([
          "id",
          "owner_id",
          "notebook_id",
          "title",
          "content",
          "plain_text",
          "content_version",
          "position",
          "archived_at",
          "created_at",
          "updated_at",
        ]),
      );

      const assetColumns = await sql`
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'page_assets'
      `;
      expect(new Set(assetColumns.map((row) => row.column_name))).toEqual(
        new Set([
          "id",
          "owner_id",
          "page_id",
          "storage_path",
          "mime",
          "size_bytes",
          "created_at",
          "updated_at",
        ]),
      );

      const [contentVersionDefault] = await sql`
        select column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'pages'
          and column_name = 'content_version'
      `;
      expect(contentVersionDefault?.column_default).toBe("1");
    } finally {
      await sql.end();
    }
  });

  it("reversion drops the three tables without touching phase 0's profiles", async () => {
    const sql = postgres(url as string, { prepare: false, max: 1 });
    try {
      await sql
        .begin(async (tx) => {
          for (const migration of REVERSIONS_DOWN_TO_0003) {
            await tx.unsafe(readDownSql(migration));
          }

          const tables = await tx`
            select table_name from information_schema.tables
            where table_schema = 'public'
              and table_name in ('notebooks', 'pages', 'page_assets')
          `;
          expect(tables).toHaveLength(0);

          const [profilesTable] = await tx`
            select table_name from information_schema.tables
            where table_schema = 'public' and table_name = 'profiles'
          `;
          expect(profilesTable).toBeDefined();

          throw new ForceRollback();
        })
        .catch((error) => {
          if (!(error instanceof ForceRollback)) throw error;
        });

      const [notebooksTable] = await sql`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name = 'notebooks'
      `;
      expect(notebooksTable).toBeDefined();
    } finally {
      await sql.end();
    }
  });
});
