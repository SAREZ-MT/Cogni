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
  });
}
