import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { runImportJobRepositoryContract } from "@/modules/ingestion/application/testing/import-job-repository.contract";
import { ABANDONED_AFTER_MS } from "@/modules/ingestion/domain/import-budget";
import type { ImportJob } from "@/modules/ingestion/domain/import-job";
// Imported from its concrete file, not the "@/modules/ingestion/
// infrastructure" barrel: see notebooks-repository.smoke.test.ts's comment
// on why (a module barrel that also exports something starting with
// `import "server-only"` breaks plain Node module resolution; this
// repository has no such sibling yet, but the convention is kept for
// consistency with every other DB smoke test in this directory).
import { DrizzleImportJobRepository } from "@/modules/ingestion/infrastructure/drizzle-import-job-repository";
import { notebooks, pages, profiles } from "@/shared/db/schema";
import { inRolledBackTx } from "./helpers/rollback";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Runs the shared ImportJobRepository contract (application/testing/
// import-job-repository.contract.ts) against DrizzleImportJobRepository
// and real cogni-dev Postgres, proving the two invariants that matter most
// across both implementations: the `claim` race (queued -> processing,
// exactly one winner) and the `storage_path` uniqueness race (design.md,
// "Puerto del repositorio"; T7a deliverable). Plus one more race the
// contract does not cover: two concurrent create()s for the very same
// storagePath (not sequential, truly concurrent), and the ON DELETE
// CASCADE from pages into import_jobs (T1 follow-up: R3-cascade-unproved).
//
// Top-level await, same pattern as drizzle-page-repository.contract.test.ts:
// the contract function reads `ids.ownerId`/`ids.pageId` while building
// each test's `it()` closures at collection time, not inside a hook, so a
// beforeAll would run too late.
const url = process.env.DATABASE_URL;

if (url) {
  const db = createTestDb();
  const owner = await createTestOwner("import-job-repo-owner");
  const notebookId = randomUUID();
  const pageId = randomUUID();

  // Registered right after the auth user exists and before any of the
  // setup inserts below, so a failure in any of them (profiles, notebooks,
  // pages) still cleans up the auth user and closes the Postgres client
  // instead of leaking both (T7a follow-up: R3-toplevel-setup-leak). The
  // client close lives in `finally` so a failed deleteTestOwner() never
  // leaks the connection either (same shape as import-jobs.smoke.test.ts's
  // afterAll).
  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values({ id: owner.id });
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno del contrato de import_jobs",
    position: 1,
  });
  await db.insert(pages).values({
    id: pageId,
    ownerId: owner.id,
    notebookId,
    title: "Página del contrato",
    content: { type: "doc", content: [] },
    position: 1,
  });

  runImportJobRepositoryContract({
    createRepository: () => new DrizzleImportJobRepository(db),
    ownerId: owner.id,
    pageId,
  });

  describe("DrizzleImportJobRepository extra races and constraints", () => {
    const repo = new DrizzleImportJobRepository(db);

    // The shared contract's storagePath test creates the two jobs
    // sequentially (create, then create again) so the second call's
    // rejection is deterministic to assert on. This test instead fires
    // both create() calls at once for the exact same storagePath, proving
    // the unique constraint — not application-level sequencing — is what
    // actually prevents the duplicate under real concurrency.
    it("create: exactly one of two concurrent creates with the same storagePath succeeds", async () => {
      const storagePath = `${owner.id}/${randomUUID()}.pdf`;
      const now = new Date("2026-09-23T10:00:00.000Z");
      const jobA = {
        id: randomUUID(),
        ownerId: owner.id,
        pageId,
        storagePath,
        fileName: "concurrente-a.pdf",
        sizeBytes: 2048,
        status: "queued" as const,
        pageCount: null,
        pagesWithoutText: 0,
        error: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const jobB = { ...jobA, id: randomUUID(), fileName: "concurrente-b.pdf" };

      const [resultA, resultB] = await Promise.all([
        repo.create(jobA),
        repo.create(jobB),
      ]);

      const outcomes = [resultA, resultB];
      const succeeded = outcomes.filter((result) => result.ok);
      const conflicted = outcomes.filter((result) => !result.ok);
      expect(succeeded).toHaveLength(1);
      expect(conflicted).toHaveLength(1);
      if (!conflicted[0].ok) {
        expect(conflicted[0].error.code).toBe(
          "IMPORT_JOB_STORAGE_PATH_CONFLICT",
        );
      }
      const winner = await repo.findByStoragePath(storagePath);
      expect([jobA.id, jobB.id]).toContain(winner?.id);
    });

    // T1 follow-up: R3-cascade-unproved — proves
    // `import_jobs.page_id REFERENCES pages.id ON DELETE CASCADE`
    // (drizzle/0005_import_jobs.sql) actually removes dependent import_jobs
    // rows instead of leaving them orphaned or blocking the page delete.
    it("cascades: deleting a page also deletes its import_jobs rows", async () => {
      await inRolledBackTx(db.$client, async (tx) => {
        const cascadePageId = randomUUID();
        await tx`
          insert into pages (id, owner_id, notebook_id, title, content, position)
          values (${cascadePageId}, ${owner.id}, ${notebookId}, 'Página a borrar', ${JSON.stringify({ type: "doc", content: [] })}::jsonb, 2)
        `;
        const jobId = randomUUID();
        await tx`
          insert into import_jobs (id, owner_id, page_id, storage_path, file_name, size_bytes)
          values (${jobId}, ${owner.id}, ${cascadePageId}, ${`${owner.id}/${randomUUID()}.pdf`}, 'a-borrar.pdf', 1024)
        `;

        await tx`delete from pages where id = ${cascadePageId}`;

        const [job] = await tx`select 1 from import_jobs where id = ${jobId}`;
        expect(job).toBeUndefined();
      });
    });
  });

  // T7a review follow-up (R3-transition-methods-unproved): the shared
  // contract only exercises `claim` and `create`'s storagePath
  // uniqueness; every other conditional `UPDATE ... RETURNING` transition
  // (markDone, markFailed, listActivePageIds' abandoned cutoff,
  // findLatestByPage's ordering) is proven here against real Postgres
  // instead. Jobs are built directly (bypassing `createImportJob`, which
  // always starts a job `queued`) so each test can seed the exact status
  // the transition under test requires.
  describe("DrizzleImportJobRepository transitions", () => {
    const repo = new DrizzleImportJobRepository(db);
    const baseNow = new Date("2026-09-23T09:00:00.000Z");

    function seedJob(overrides: Partial<ImportJob> = {}): ImportJob {
      return {
        id: randomUUID(),
        ownerId: owner.id,
        pageId,
        storagePath: `${owner.id}/${randomUUID()}.pdf`,
        fileName: "notas.pdf",
        sizeBytes: 1024,
        status: "queued",
        pageCount: null,
        pagesWithoutText: 0,
        error: null,
        startedAt: null,
        finishedAt: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        ...overrides,
      };
    }

    it("markDone: processing -> done, persisting the counts", async () => {
      const job = seedJob({ status: "processing", startedAt: baseNow });
      await repo.create(job);
      const now = new Date("2026-09-23T09:05:00.000Z");

      const done = await repo.markDone({
        id: job.id,
        pageCount: 12,
        pagesWithoutText: 2,
        now,
      });

      expect(done?.status).toBe("done");
      expect(done?.pageCount).toBe(12);
      expect(done?.pagesWithoutText).toBe(2);
      expect(done?.finishedAt).toEqual(now);
    });

    it("markDone: rejected on a queued job, row left unchanged", async () => {
      const job = seedJob({ status: "queued" });
      await repo.create(job);

      const result = await repo.markDone({
        id: job.id,
        pageCount: 5,
        pagesWithoutText: 0,
        now: new Date("2026-09-23T09:05:00.000Z"),
      });

      expect(result).toBeNull();
      const stored = await repo.findById(job.id);
      expect(stored?.status).toBe("queued");
      expect(stored?.pageCount).toBeNull();
    });

    it("markDone: rejected on an already-terminal job, row left unchanged", async () => {
      const job = seedJob({
        status: "failed",
        error: "ya falló antes",
        finishedAt: baseNow,
      });
      await repo.create(job);

      const result = await repo.markDone({
        id: job.id,
        pageCount: 5,
        pagesWithoutText: 0,
        now: new Date("2026-09-23T09:05:00.000Z"),
      });

      expect(result).toBeNull();
      const stored = await repo.findById(job.id);
      expect(stored?.status).toBe("failed");
      expect(stored?.error).toBe("ya falló antes");
    });

    it("markFailed: timeout on a queued job transitions to failed (the only queued -> failed path)", async () => {
      const job = seedJob({ status: "queued" });
      await repo.create(job);
      const now = new Date("2026-09-23T09:10:00.000Z");

      const failed = await repo.markFailed({
        id: job.id,
        kind: "timeout",
        message: "La importación tardó demasiado.",
        now,
      });

      expect(failed?.status).toBe("failed");
      expect(failed?.error).toBe("La importación tardó demasiado.");
      expect(failed?.finishedAt).toEqual(now);
    });

    it("markFailed: a non-timeout reason on a queued job is rejected, row left unchanged", async () => {
      const job = seedJob({ status: "queued" });
      await repo.create(job);

      const result = await repo.markFailed({
        id: job.id,
        kind: "download",
        message: "No pudimos leer el archivo.",
        now: new Date("2026-09-23T09:10:00.000Z"),
      });

      expect(result).toBeNull();
      const stored = await repo.findById(job.id);
      expect(stored?.status).toBe("queued");
      expect(stored?.error).toBeNull();
    });

    it("markFailed: on a processing job keeps pageCount/pagesWithoutText when omitted", async () => {
      const job = seedJob({
        status: "processing",
        startedAt: baseNow,
        pageCount: 8,
        pagesWithoutText: 3,
      });
      await repo.create(job);
      const now = new Date("2026-09-23T09:12:00.000Z");

      const failed = await repo.markFailed({
        id: job.id,
        kind: "persistence",
        message: "La página cambió durante la importación.",
        now,
      });

      expect(failed?.status).toBe("failed");
      expect(failed?.pageCount).toBe(8);
      expect(failed?.pagesWithoutText).toBe(3);
    });

    it("listActivePageIds: excludes a processing job older than ABANDONED_AFTER_MS and includes a fresh one", async () => {
      const freshPageId = randomUUID();
      const abandonedPageId = randomUUID();
      await db.insert(pages).values([
        {
          id: freshPageId,
          ownerId: owner.id,
          notebookId,
          title: "Página con importación activa",
          content: { type: "doc", content: [] },
          position: 3,
        },
        {
          id: abandonedPageId,
          ownerId: owner.id,
          notebookId,
          title: "Página con importación abandonada",
          content: { type: "doc", content: [] },
          position: 4,
        },
      ]);
      // listActivePageIds derives its cutoff from the real wall clock
      // (Date.now()), not an injectable clock (the port carries no `now`
      // parameter) — this test must use real timestamps around it too.
      const realNow = Date.now();
      const abandonedUpdatedAt = new Date(
        realNow - ABANDONED_AFTER_MS - 60_000,
      );
      const freshUpdatedAt = new Date(realNow - 1_000);

      await repo.create(
        seedJob({
          pageId: abandonedPageId,
          status: "processing",
          createdAt: abandonedUpdatedAt,
          updatedAt: abandonedUpdatedAt,
        }),
      );
      await repo.create(
        seedJob({
          pageId: freshPageId,
          status: "processing",
          createdAt: freshUpdatedAt,
          updatedAt: freshUpdatedAt,
        }),
      );

      const activePageIds = await repo.listActivePageIds(owner.id);

      expect(activePageIds).toContain(freshPageId);
      expect(activePageIds).not.toContain(abandonedPageId);
    });

    it("findLatestByPage: returns the newest job by createdAt when several exist for a page", async () => {
      const retriedPageId = randomUUID();
      await db.insert(pages).values({
        id: retriedPageId,
        ownerId: owner.id,
        notebookId,
        title: "Página con reintentos",
        content: { type: "doc", content: [] },
        position: 5,
      });
      const olderJob = seedJob({
        pageId: retriedPageId,
        status: "failed",
        error: "primer intento fallido",
        createdAt: new Date("2026-09-23T08:00:00.000Z"),
        updatedAt: new Date("2026-09-23T08:00:01.000Z"),
        finishedAt: new Date("2026-09-23T08:00:01.000Z"),
      });
      const newerJob = seedJob({
        pageId: retriedPageId,
        status: "queued",
        createdAt: new Date("2026-09-23T09:00:00.000Z"),
        updatedAt: new Date("2026-09-23T09:00:00.000Z"),
      });
      // Insert the newer job first so a naive "last inserted" read would
      // fail this test the same way a naive "first inserted" read would —
      // only ordering by createdAt itself passes either way.
      await repo.create(newerJob);
      await repo.create(olderJob);

      const latest = await repo.findLatestByPage(retriedPageId);

      expect(latest?.id).toBe(newerJob.id);
    });
  });
}
