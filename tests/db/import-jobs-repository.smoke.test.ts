import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { runImportJobRepositoryContract } from "@/modules/ingestion/application/testing/import-job-repository.contract";
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

  afterAll(async () => {
    // Deleting the auth user cascades into profiles, notebooks, pages and
    // every import_jobs row the contract created along the way — no
    // per-test cleanup needed, same as notebooks-repository.smoke.test.ts.
    await deleteTestOwner(owner.id);
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
}
