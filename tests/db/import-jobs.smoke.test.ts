import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// Guards drizzle/0005_import_jobs.sql (+ .down.sql). Scenarios "Migración
// aplicada" / "Migración revertida", specs/pdf-import/spec.md, Requirement
// "Modelo de datos de `ImportJob`".
const url = process.env.DATABASE_URL;

function readDownSql(): string {
  return readFileSync(
    path.join(process.cwd(), "drizzle", "0005_import_jobs.down.sql"),
    "utf8",
  );
}

class ForceRollback extends Error {}

// Runs `work` in a transaction that is always rolled back, so the smoke
// test never leaves import_jobs rows behind in cogni-dev.
async function inRolledBackTx(
  sql: postgres.Sql,
  work: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<void> {
  await sql
    .begin(async (tx) => {
      await work(tx);
      throw new ForceRollback();
    })
    .catch((error) => {
      if (!(error instanceof ForceRollback)) throw error;
    });
}

// Returns the name of the constraint the statement violated, or null.
async function violatedConstraint(
  sql: postgres.Sql,
  work: (tx: postgres.TransactionSql) => Promise<unknown>,
): Promise<string | null> {
  try {
    await sql.begin(async (tx) => {
      await work(tx);
      throw new ForceRollback();
    });
    return null;
  } catch (error) {
    if (error instanceof ForceRollback) return null;
    return (error as postgres.PostgresError).constraint_name ?? null;
  }
}

describe.skipIf(!url)("0005 import_jobs schema", () => {
  let owner: TestOwner;
  const pageId = randomUUID();
  const sql = postgres(url as string, { prepare: false, max: 1 });

  function insertJob(
    tx: postgres.TransactionSql,
    values: { storagePath: string; status?: string },
  ) {
    return tx`
      insert into import_jobs (id, owner_id, page_id, storage_path, file_name, size_bytes, status)
      values (
        ${randomUUID()}, ${owner.id}, ${pageId}, ${values.storagePath},
        'apuntes.pdf', 1024, ${values.status ?? "queued"}
      )
    `;
  }

  beforeAll(async () => {
    owner = await createTestOwner("import-jobs-schema");
    const notebookId = randomUUID();
    await sql`insert into profiles (id) values (${owner.id})`;
    await sql`
      insert into notebooks (id, owner_id, title, position)
      values (${notebookId}, ${owner.id}, 'Cuaderno', 0)
    `;
    await sql`
      insert into pages (id, owner_id, notebook_id, title, content, position)
      values (${pageId}, ${owner.id}, ${notebookId}, 'Página', ${sql.json({ type: "doc" })}, 0)
    `;
  });

  afterAll(async () => {
    // Deleting the auth user cascades into profiles, notebooks and pages.
    await deleteTestOwner(owner.id);
    await sql.end();
  });

  it("creates import_jobs with the declared columns", async () => {
    const columns = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'import_jobs'
    `;
    expect(new Set(columns.map((row) => row.column_name))).toEqual(
      new Set([
        "id",
        "owner_id",
        "page_id",
        "storage_path",
        "file_name",
        "size_bytes",
        "status",
        "page_count",
        "pages_without_text",
        "error",
        "started_at",
        "finished_at",
        "created_at",
        "updated_at",
      ]),
    );
  });

  it("starts a job queued, with no page count and zero pages without text", async () => {
    await inRolledBackTx(sql, async (tx) => {
      const [row] = await tx`
        insert into import_jobs (id, owner_id, page_id, storage_path, file_name, size_bytes)
        values (${randomUUID()}, ${owner.id}, ${pageId}, ${`${owner.id}/defaults.pdf`}, 'apuntes.pdf', 1024)
        returning status, page_count, pages_without_text, error
      `;
      expect(row).toEqual({
        status: "queued",
        page_count: null,
        pages_without_text: 0,
        error: null,
      });
    });
  });

  it("rejects a status outside queued, processing, done and failed", async () => {
    const constraint = await violatedConstraint(sql, (tx) =>
      insertJob(tx, {
        storagePath: `${owner.id}/bad-status.pdf`,
        status: "cancelled",
      }),
    );
    expect(constraint).toBe("import_jobs_status_check");
  });

  it("rejects a duplicated storage_path", async () => {
    const storagePath = `${owner.id}/duplicated.pdf`;
    const constraint = await violatedConstraint(sql, async (tx) => {
      await insertJob(tx, { storagePath });
      await insertJob(tx, { storagePath });
    });
    expect(constraint).toBe("import_jobs_storage_path_key");
  });

  it("reversion drops import_jobs and keeps the phase 0 and 1 tables", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await tx.unsafe(readDownSql());

      const tables = await tx`
        select table_name from information_schema.tables
        where table_schema = 'public'
          and table_name in ('import_jobs', 'profiles', 'notebooks', 'pages', 'page_assets')
        order by table_name
      `;
      expect(tables.map((row) => row.table_name)).toEqual([
        "notebooks",
        "page_assets",
        "pages",
        "profiles",
      ]);
    });

    const [importJobsTable] = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name = 'import_jobs'
    `;
    expect(importJobsTable?.table_name).toBe("import_jobs");
  });
});
