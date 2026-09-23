import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IMPORT_JOB_STATUSES } from "@/shared/db/schema";
import { ForceRollback, inRolledBackTx, readDownSql } from "./helpers/rollback";
import {
  createTestOwner,
  deleteTestOwner,
  type TestOwner,
} from "./helpers/test-owner";

// Guards drizzle/0005_import_jobs.sql (+ .down.sql). Scenarios "Migración
// aplicada" / "Migración revertida", specs/pdf-import/spec.md, Requirement
// "Modelo de datos de `ImportJob`".
const url = process.env.DATABASE_URL;

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
  // Undefined until beforeAll assigns it — guarded in afterAll (T1
  // follow-up: R3-afterall-undefined-owner) so a beforeAll failure never
  // throws a second, more confusing error out of afterAll on top of the
  // original one.
  let owner: TestOwner | undefined;
  const pageId = randomUUID();
  const sql = postgres(url as string, { prepare: false, max: 1 });

  // Every call site below runs after beforeAll assigned `owner`, but that
  // spans a different closure than beforeAll's own assignment, so the
  // compiler cannot narrow `owner` back to non-undefined there. A thrown
  // error (never a silently-interpolated "undefined" from `owner?.id`)
  // keeps the same fail-loud intent a non-null assertion would have had.
  function ownerId(): string {
    if (!owner) throw new Error("owner was not initialized by beforeAll");
    return owner.id;
  }

  function insertJob(
    tx: postgres.TransactionSql,
    values: { storagePath: string; status?: string },
  ) {
    return tx`
      insert into import_jobs (id, owner_id, page_id, storage_path, file_name, size_bytes, status)
      values (
        ${randomUUID()}, ${ownerId()}, ${pageId}, ${values.storagePath},
        'apuntes.pdf', 1024, ${values.status ?? "queued"}
      )
    `;
  }

  beforeAll(async () => {
    owner = await createTestOwner("import-jobs-schema");
    const notebookId = randomUUID();
    await sql`insert into profiles (id) values (${ownerId()})`;
    await sql`
      insert into notebooks (id, owner_id, title, position)
      values (${notebookId}, ${ownerId()}, 'Cuaderno', 0)
    `;
    await sql`
      insert into pages (id, owner_id, notebook_id, title, content, position)
      values (${pageId}, ${ownerId()}, ${notebookId}, 'Página', ${sql.json({ type: "doc" })}, 0)
    `;
  });

  afterAll(async () => {
    // owner may still be undefined if beforeAll itself threw (e.g. Supabase
    // admin.createUser failed): guard it so that original failure is the
    // only one reported, instead of a second "Cannot read properties of
    // undefined" masking it. sql.end() always runs, in `finally`, so a
    // failed deleteTestOwner never leaks the connection (T1 follow-up:
    // R3-afterall-undefined-owner).
    try {
      if (owner) await deleteTestOwner(owner.id);
    } finally {
      await sql.end();
    }
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
        values (${randomUUID()}, ${ownerId()}, ${pageId}, ${`${ownerId()}/defaults.pdf`}, 'apuntes.pdf', 1024)
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
        storagePath: `${ownerId()}/bad-status.pdf`,
        status: "cancelled",
      }),
    );
    expect(constraint).toBe("import_jobs_status_check");
  });

  // The check() call in schema.ts is a hand-written SQL literal, not
  // derived from IMPORT_JOB_STATUSES (deriving it risked changing the
  // already-applied migration's generated SQL byte-for-byte — see the
  // comment above that tuple). This test is the safety net that keeps the
  // two from drifting apart instead (T1 follow-up: R2-status-untyped).
  it("keeps the status CHECK constraint's allowed values equal to IMPORT_JOB_STATUSES", async () => {
    const [constraint] = await sql`
      select pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conname = 'import_jobs_status_check'
    `;
    const allowedValues = [
      ...String(constraint?.definition ?? "").matchAll(/'([^']+)'/g),
    ].map((match) => match[1]);
    expect(new Set(allowedValues)).toEqual(new Set(IMPORT_JOB_STATUSES));
  });

  it("rejects a duplicated storage_path", async () => {
    const storagePath = `${ownerId()}/duplicated.pdf`;
    const constraint = await violatedConstraint(sql, async (tx) => {
      await insertJob(tx, { storagePath });
      await insertJob(tx, { storagePath });
    });
    expect(constraint).toBe("import_jobs_storage_path_key");
  });

  it("reversion drops import_jobs and keeps the phase 0 and 1 tables", async () => {
    await inRolledBackTx(sql, async (tx) => {
      await tx.unsafe(readDownSql("0005_import_jobs"));

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
