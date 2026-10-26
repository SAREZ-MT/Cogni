import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { DomainError } from "@/shared/kernel/domain-error";
import { createImportJob, type NewImportJob } from "../../domain/import-job";
import type { ImportJobRepository } from "../../domain/import-job-repository";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
// A fixed page id the in-memory suite never has to back with a real row.
// Exported so a DB-backed caller (tests/db/import-jobs-repository.smoke.
// test.ts) can create a matching `pages` row and pass its real id instead,
// satisfying the page_id foreign key the in-memory double does not have.
export const DEFAULT_PAGE_ID = "1e2d3c4b-5a69-4788-9f01-2a3b4c5d6e7f";
const CLOCK = { now: () => new Date("2026-09-23T10:00:00.000Z") };

export interface ImportJobRepositoryContractIds {
  ownerId?: string;
  pageId?: string;
}

export interface ImportJobRepositoryContractContext
  extends ImportJobRepositoryContractIds {
  // A fresh, empty repository for each test — the in-memory fake
  // (`pnpm test`) and the Drizzle repository against `cogni-dev`
  // (`pnpm test:db`, T7a) both implement this factory.
  createRepository(): ImportJobRepository | Promise<ImportJobRepository>;
}

// `id` defaults to a fresh random uuid on every call (never reused across
// the three `it()` blocks below, so a DB-backed run needs no per-test
// rollback: the real table's primary key never collides). `pageId`
// defaults to the caller's fixed id — real Postgres requires a `pages`
// row that satisfies the `page_id` foreign key, so it must stay the same
// value across every job the contract creates, unlike `id`.
function newJobInput(
  ids: Required<ImportJobRepositoryContractIds>,
  overrides: Partial<NewImportJob> = {},
): NewImportJob {
  return {
    id: overrides.id ?? randomUUID(),
    ownerId: overrides.ownerId ?? ids.ownerId,
    pageId: overrides.pageId ?? ids.pageId,
    storagePath: overrides.storagePath ?? `${ids.ownerId}/${randomUUID()}.pdf`,
    fileName: overrides.fileName ?? "notas.pdf",
    sizeBytes: overrides.sizeBytes ?? 1024,
  };
}

// design.md, "Puerto del repositorio": "Un test de contrato compartido ...
// corre contra InMemoryImportJobRepository (pnpm test) y
// DrizzleImportJobRepository (pnpm test:db)". Exercises exactly the two
// invariants that matter across both implementations: `claim`'s
// queued -> processing conditional transition (only one of two calls on
// the same job may win) and `create`'s storage_path uniqueness (the T1
// unique constraint on the real table). T7a imports
// `runImportJobRepositoryContract` and calls it again with a factory that
// builds a `DrizzleImportJobRepository` against `cogni-dev`.
export function runImportJobRepositoryContract(
  context: ImportJobRepositoryContractContext,
): void {
  const ids: Required<ImportJobRepositoryContractIds> = {
    ownerId: context.ownerId ?? OWNER_ID,
    pageId: context.pageId ?? DEFAULT_PAGE_ID,
  };

  describe("ImportJobRepository contract", () => {
    it("claim: exactly one of two claims on the same queued job wins", async () => {
      const repo = await context.createRepository();
      const job = createImportJob(newJobInput(ids), CLOCK);
      const created = await repo.create(job);
      expect(created.ok).toBe(true);

      const now = new Date("2026-09-23T10:00:05.000Z");
      const [first, second] = await Promise.all([
        repo.claim({ id: job.id, now }),
        repo.claim({ id: job.id, now }),
      ]);

      const winners = [first, second].filter(
        (result): result is NonNullable<typeof result> => result !== null,
      );
      expect(winners).toHaveLength(1);
      expect(winners[0]?.status).toBe("processing");
      expect(winners[0]?.startedAt).toEqual(now);
    });

    it("claim: returns null for a job that is no longer queued", async () => {
      const repo = await context.createRepository();
      const job = createImportJob(newJobInput(ids), CLOCK);
      await repo.create(job);
      const now = new Date("2026-09-23T10:00:05.000Z");
      await repo.claim({ id: job.id, now });

      const secondClaim = await repo.claim({ id: job.id, now });

      expect(secondClaim).toBeNull();
    });

    it("create: a second job with the same storagePath returns a typed conflict instead of overwriting the first", async () => {
      const repo = await context.createRepository();
      const storagePath = `${ids.ownerId}/${randomUUID()}.pdf`;
      const first = createImportJob(newJobInput(ids, { storagePath }), CLOCK);
      const second = createImportJob(newJobInput(ids, { storagePath }), CLOCK);

      const firstCreated = await repo.create(first);
      const secondCreated = await repo.create(second);

      expect(firstCreated.ok).toBe(true);
      expect(secondCreated.ok).toBe(false);
      // A direct cast instead of an `if (!secondCreated.ok)` narrowing:
      // the assertion above already proves the shape, and a conditional
      // here would leave an untaken branch in this reusable contract file
      // (unlike a `.test.ts` file, this one counts toward coverage).
      const conflictError = (secondCreated as { ok: false; error: DomainError })
        .error;
      expect(conflictError.code).toBe("IMPORT_JOB_STORAGE_PATH_CONFLICT");
      const winner = await repo.findByStoragePath(storagePath);
      expect(winner?.id).toBe(first.id);
    });

    // document-import T10: the format column and the skipped-images count.
    it("create/findById round-trip the format; markDone persists skippedImages", async () => {
      const repo = await context.createRepository();
      const job = createImportJob(
        newJobInput(ids, {
          storagePath: `${ids.ownerId}/${randomUUID()}.docx`,
        }),
        CLOCK,
      );
      await repo.create(job);
      expect((await repo.findById(job.id))?.format).toBe("docx");

      const now = new Date("2026-09-23T10:00:05.000Z");
      await repo.claim({ id: job.id, now });
      const done = await repo.markDone({
        id: job.id,
        pageCount: 1,
        pagesWithoutText: 0,
        skippedImages: 2,
        now,
      });

      expect(done?.skippedImages).toBe(2);
      expect((await repo.findById(job.id))?.skippedImages).toBe(2);
    });

    // document-import T10 (T9b review: check-then-act race): with
    // `maxActiveJobs`, create() itself enforces the cap, so concurrent
    // starts can never leave the owner with more active jobs than allowed.
    // A far-future clock makes every job earlier tests left active read as
    // abandoned, so the count starts at 0 on a shared database too.
    it("create with maxActiveJobs: concurrent creates never exceed the cap", async () => {
      const repo = await context.createRepository();
      const now = new Date("2030-01-01T00:00:00.000Z");
      const jobs = Array.from({ length: 5 }, () =>
        createImportJob(newJobInput(ids), { now: () => now }),
      );

      const results = await Promise.all(
        jobs.map((job) => repo.create(job, { maxActiveJobs: 3 })),
      );

      expect(results.filter((result) => result.ok)).toHaveLength(3);
      const refused = results.filter((result) => !result.ok) as Array<{
        ok: false;
        error: DomainError;
      }>;
      expect(refused.map((result) => result.error.code)).toEqual([
        "IMPORT_JOB_ACTIVE_LIMIT_REACHED",
        "IMPORT_JOB_ACTIVE_LIMIT_REACHED",
      ]);
      expect(await repo.countActiveJobs(ids.ownerId, now)).toBe(3);
    });

    // document-import T9b: the per-user cap on concurrent imports. Counted
    // as a delta at both instants so rows earlier cases left behind on a
    // shared database stay out of the assertion (T11: the cap case above
    // leaves three jobs updated in 2030, which are still active a day
    // after `now` — abandonment is judged against the passed clock, and a
    // job updated after it is not abandoned).
    it("countActiveJobs: counts the owner's queued and processing jobs, not terminal or abandoned ones", async () => {
      const repo = await context.createRepository();
      const now = new Date("2026-09-23T10:00:05.000Z");
      const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const before = await repo.countActiveJobs(ids.ownerId, now);
      const beforeLater = await repo.countActiveJobs(ids.ownerId, later);
      const queued = createImportJob(newJobInput(ids), CLOCK);
      const processing = createImportJob(newJobInput(ids), CLOCK);
      const failed = createImportJob(newJobInput(ids), CLOCK);
      for (const job of [queued, processing, failed]) await repo.create(job);
      await repo.claim({ id: processing.id, now });
      await repo.claim({ id: failed.id, now });
      await repo.markFailed({
        id: failed.id,
        kind: "invalid_document",
        message: "x",
        now,
      });

      expect(await repo.countActiveJobs(ids.ownerId, now)).toBe(before + 2);
      // Long after: both are abandoned, so neither blocks a new import.
      expect(await repo.countActiveJobs(ids.ownerId, later)).toBe(beforeLater);
    });
  });
}
