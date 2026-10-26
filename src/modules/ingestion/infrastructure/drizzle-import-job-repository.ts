import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import type { Db } from "@/shared/db/client";
import { type ImportJobRow, importJobs } from "@/shared/db/schema";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { IMPORT_JOB_ERROR } from "../domain/errors";
import { ABANDONED_AFTER_MS } from "../domain/import-budget";
import type { ImportFailureKind } from "../domain/import-failure";
import type { ImportJob } from "../domain/import-job";
import type { ImportJobRepository } from "../domain/import-job-repository";

// The unique constraint `create()` maps to a typed conflict instead of
// letting the raw PostgresError escape (drizzle/0005_import_jobs.sql,
// domain/import-job-repository.ts's port comment).
const STORAGE_PATH_UNIQUE_CONSTRAINT = "import_jobs_storage_path_key";

function toImportJob(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    storagePath: row.storagePath,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    format: row.format,
    status: row.status,
    pageCount: row.pageCount,
    pagesWithoutText: row.pagesWithoutText,
    skippedImages: row.skippedImages,
    error: row.error,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Drizzle implementation of ImportJobRepository (design.md, "Puerto del
// repositorio"): every transition is one atomic conditional
// `UPDATE ... RETURNING`, the same pattern DrizzlePageRepository's
// updateIfVersion uses, so two concurrent or repeated calls on the same
// job can never duplicate work or reopen a terminal state. Proven against
// real Postgres by the shared contract
// (application/testing/import-job-repository.contract.ts) plus extra
// races in tests/db/import-jobs-repository.smoke.test.ts.
// Drizzle wraps driver failures in a DrizzleQueryError whose `cause` holds the
// original PostgresError, so the unique-violation check must look through the
// wrapper as well as at a bare driver error.
function isStoragePathUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current instanceof Error; depth += 1) {
    if (
      current instanceof postgres.PostgresError &&
      current.constraint_name === STORAGE_PATH_UNIQUE_CONSTRAINT
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

export class DrizzleImportJobRepository implements ImportJobRepository {
  constructor(private readonly db: Db) {}

  async create(job: ImportJob): Promise<Result<void, DomainError>> {
    try {
      await this.db.insert(importJobs).values({
        id: job.id,
        ownerId: job.ownerId,
        pageId: job.pageId,
        storagePath: job.storagePath,
        fileName: job.fileName,
        sizeBytes: job.sizeBytes,
        format: job.format,
        status: job.status,
        pageCount: job.pageCount,
        pagesWithoutText: job.pagesWithoutText,
        skippedImages: job.skippedImages,
        error: job.error,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
      return ok(undefined);
    } catch (error) {
      if (isStoragePathUniqueViolation(error)) {
        return err(
          new DomainError(
            IMPORT_JOB_ERROR.STORAGE_PATH_CONFLICT,
            job.storagePath,
          ),
        );
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ImportJob | null> {
    const row = await this.db.query.importJobs.findFirst({
      where: eq(importJobs.id, id),
    });
    return row ? toImportJob(row) : null;
  }

  async findByStoragePath(storagePath: string): Promise<ImportJob | null> {
    const row = await this.db.query.importJobs.findFirst({
      where: eq(importJobs.storagePath, storagePath),
    });
    return row ? toImportJob(row) : null;
  }

  // "Latest" by createdAt: a page can only ever have one non-abandoned
  // active job at a time (idempotent by storagePath), but a retried
  // import after a `failed` job creates a second row for the same page.
  async findLatestByPage(
    pageId: string,
    ownerId?: string,
  ): Promise<ImportJob | null> {
    const row = await this.db.query.importJobs.findFirst({
      where:
        ownerId === undefined
          ? eq(importJobs.pageId, pageId)
          : and(eq(importJobs.pageId, pageId), eq(importJobs.ownerId, ownerId)),
      orderBy: [desc(importJobs.createdAt)],
    });
    return row ? toImportJob(row) : null;
  }

  // queued or processing, not abandoned (design.md's isAbandoned rule,
  // reimplemented here against the wall clock since this port method
  // carries no injectable `now` — the in-memory fake's optional `now`
  // parameter is a test-only extension beyond the port).
  async listActivePageIds(ownerId: string): Promise<string[]> {
    const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS);
    const rows = await this.db
      .selectDistinct({ pageId: importJobs.pageId })
      .from(importJobs)
      .where(
        and(
          eq(importJobs.ownerId, ownerId),
          inArray(importJobs.status, ["queued", "processing"]),
          gt(importJobs.updatedAt, cutoff),
        ),
      );
    return rows.map((row) => row.pageId);
  }

  // document-import T9b: the same active-and-not-abandoned rule as
  // listActivePageIds, against the caller's `now`.
  async countActiveJobs(ownerId: string, now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - ABANDONED_AFTER_MS);
    const rows = await this.db
      .select({ count: count() })
      .from(importJobs)
      .where(
        and(
          eq(importJobs.ownerId, ownerId),
          inArray(importJobs.status, ["queued", "processing"]),
          gt(importJobs.updatedAt, cutoff),
        ),
      );
    return Number(rows[0]?.count ?? 0);
  }

  // queued -> processing. Conditional on the WHERE clause, not a
  // read-then-write: two concurrent claims race the same UPDATE and only
  // one RETURNING row ever comes back (design.md's claim SQL).
  async claim(input: { id: string; now: Date }): Promise<ImportJob | null> {
    const rows = await this.db
      .update(importJobs)
      .set({ status: "processing", startedAt: input.now, updatedAt: input.now })
      .where(and(eq(importJobs.id, input.id), eq(importJobs.status, "queued")))
      .returning();
    return rows[0] ? toImportJob(rows[0]) : null;
  }

  // processing -> done.
  async markDone(input: {
    id: string;
    pageCount: number;
    pagesWithoutText: number;
    skippedImages: number;
    now: Date;
  }): Promise<ImportJob | null> {
    const rows = await this.db
      .update(importJobs)
      .set({
        status: "done",
        pageCount: input.pageCount,
        pagesWithoutText: input.pagesWithoutText,
        skippedImages: input.skippedImages,
        finishedAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(eq(importJobs.id, input.id), eq(importJobs.status, "processing")),
      )
      .returning();
    return rows[0] ? toImportJob(rows[0]) : null;
  }

  // processing -> failed (any kind), or queued -> failed only for
  // "timeout" (mirrors domain/import-job.ts's fail() precondition).
  // pageCount/pagesWithoutText are optional: when the caller does not
  // supply them, the existing column value is kept via a raw column
  // reference instead of overwriting it with null (same rule as fail()'s
  // `counts.pageCount ?? job.pageCount`).
  async markFailed(input: {
    id: string;
    kind: ImportFailureKind;
    message: string;
    pageCount?: number;
    pagesWithoutText?: number;
    now: Date;
  }): Promise<ImportJob | null> {
    const statusCondition =
      input.kind === "timeout"
        ? inArray(importJobs.status, ["processing", "queued"])
        : eq(importJobs.status, "processing");

    const rows = await this.db
      .update(importJobs)
      .set({
        status: "failed",
        error: input.message,
        pageCount:
          input.pageCount !== undefined
            ? input.pageCount
            : sql`${importJobs.pageCount}`,
        pagesWithoutText:
          input.pagesWithoutText !== undefined
            ? input.pagesWithoutText
            : sql`${importJobs.pagesWithoutText}`,
        finishedAt: input.now,
        updatedAt: input.now,
      })
      .where(and(eq(importJobs.id, input.id), statusCondition))
      .returning();
    return rows[0] ? toImportJob(rows[0]) : null;
  }
}
