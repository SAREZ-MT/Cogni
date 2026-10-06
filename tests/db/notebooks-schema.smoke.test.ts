import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { inRolledBackReversion, readDownSql } from "./helpers/rollback";

// Guards drizzle/0003_notebooks_pages_assets.sql (+ .down.sql).
// Scenarios "Migracion aplicada" / "Migracion revertida",
// specs/notebooks/spec.md, Requirement "Modelo de datos segun S6.1".
const url = process.env.DATABASE_URL;

// Reversions run newest first. import_jobs (0005), ai_generations /
// flashcards (0007), the study-engine tables (0009) and the exam tables
// (0010) reference pages, so they must be reverted before 0003 can drop the
// tables they depend on.
const REVERSIONS_DOWN_TO_0003 = [
  "0012_active_recall",
  "0011_exam_session_questions",
  "0010_exams",
  "0009_study_engine",
  "0007_ai_generations_flashcards",
  "0005_import_jobs",
  "0003_notebooks_pages_assets",
];

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
      await inRolledBackReversion(sql, async (tx) => {
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
