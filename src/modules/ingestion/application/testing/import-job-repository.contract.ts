import { describe, expect, it } from "vitest";
import type { DomainError } from "@/shared/kernel/domain-error";
import { createImportJob, type NewImportJob } from "../../domain/import-job";
import type { ImportJobRepository } from "../../domain/import-job-repository";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const CLOCK = { now: () => new Date("2026-09-23T10:00:00.000Z") };

function newJobInput(overrides: Partial<NewImportJob> = {}): NewImportJob {
  return {
    id: overrides.id ?? "job-1",
    ownerId: overrides.ownerId ?? OWNER_ID,
    pageId: overrides.pageId ?? "page-1",
    storagePath: overrides.storagePath ?? `${OWNER_ID}/upload-1.pdf`,
    fileName: overrides.fileName ?? "notas.pdf",
    sizeBytes: overrides.sizeBytes ?? 1024,
  };
}

export interface ImportJobRepositoryContractContext {
  // A fresh, empty repository for each test — the in-memory fake
  // (`pnpm test`) and the Drizzle repository against `cogni-dev`
  // (`pnpm test:db`, T7) both implement this factory.
  createRepository(): ImportJobRepository | Promise<ImportJobRepository>;
}

// design.md, "Puerto del repositorio": "Un test de contrato compartido ...
// corre contra InMemoryImportJobRepository (pnpm test) y
// DrizzleImportJobRepository (pnpm test:db)". Exercises exactly the two
// invariants that matter across both implementations: `claim`'s
// queued -> processing conditional transition (only one of two calls on
// the same job may win) and `create`'s storage_path uniqueness (the T1
// unique constraint on the real table). T7 imports
// `runImportJobRepositoryContract` and calls it again with a factory that
// builds a `DrizzleImportJobRepository` against `cogni-dev`.
export function runImportJobRepositoryContract(
  context: ImportJobRepositoryContractContext,
): void {
  describe("ImportJobRepository contract", () => {
    it("claim: exactly one of two claims on the same queued job wins", async () => {
      const repo = await context.createRepository();
      const job = createImportJob(newJobInput(), CLOCK);
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
      const job = createImportJob(newJobInput(), CLOCK);
      await repo.create(job);
      const now = new Date("2026-09-23T10:00:05.000Z");
      await repo.claim({ id: job.id, now });

      const secondClaim = await repo.claim({ id: job.id, now });

      expect(secondClaim).toBeNull();
    });

    it("create: a second job with the same storagePath returns a typed conflict instead of overwriting the first", async () => {
      const repo = await context.createRepository();
      const storagePath = `${OWNER_ID}/upload-conflict.pdf`;
      const first = createImportJob(
        newJobInput({ id: "job-a", storagePath }),
        CLOCK,
      );
      const second = createImportJob(
        newJobInput({ id: "job-b", storagePath }),
        CLOCK,
      );

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
      expect(winner?.id).toBe("job-a");
    });
  });
}
