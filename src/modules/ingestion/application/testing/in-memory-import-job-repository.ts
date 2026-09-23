import type { Clock } from "@/shared/kernel/clock";
import type { ImportFailureKind } from "../../domain/import-failure";
import {
  complete,
  fail,
  type ImportJob,
  isAbandoned,
  start,
} from "../../domain/import-job";
import type { ImportJobRepository } from "../../domain/import-job-repository";

function clockAt(now: Date): Clock {
  return { now: () => now };
}

// In-memory ImportJobRepository for `pnpm test` (design.md: "Un test de
// contrato compartido ... corre contra InMemoryImportJobRepository (pnpm
// test) y DrizzleImportJobRepository (pnpm test:db)", added in T6).
// `claim`/`markDone`/`markFailed` reuse the pure domain transitions
// (`start`/`complete`/`fail`) so this fake enforces the exact same
// invariants the real conditional `UPDATE ... RETURNING` does: a
// transition that the domain rejects (wrong status, invalid counts, ...)
// returns null, exactly like "another call already won" or "nothing
// changed" would against the real database.
export class InMemoryImportJobRepository implements ImportJobRepository {
  private readonly jobs = new Map<string, ImportJob>();

  async create(job: ImportJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async findById(id: string): Promise<ImportJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async findByStoragePath(storagePath: string): Promise<ImportJob | null> {
    for (const job of this.jobs.values()) {
      if (job.storagePath === storagePath) return job;
    }
    return null;
  }

  async findLatestByPage(pageId: string): Promise<ImportJob | null> {
    let latest: ImportJob | null = null;
    for (const job of this.jobs.values()) {
      if (job.pageId !== pageId) continue;
      if (!latest || job.createdAt.getTime() > latest.createdAt.getTime()) {
        latest = job;
      }
    }
    return latest;
  }

  // `now` is an extra optional parameter beyond the ImportJobRepository
  // interface (structurally still satisfies it: a caller passing only
  // `ownerId` gets the real wall clock), added so tests can pin the
  // abandoned-job cutoff deterministically instead of racing
  // `ABANDONED_AFTER_MS` (150 s) against the real clock.
  async listActivePageIds(
    ownerId: string,
    now: Date = new Date(),
  ): Promise<string[]> {
    const pageIds = new Set<string>();
    for (const job of this.jobs.values()) {
      if (job.ownerId !== ownerId) continue;
      if (job.status !== "queued" && job.status !== "processing") continue;
      if (isAbandoned(job, now)) continue;
      pageIds.add(job.pageId);
    }
    return [...pageIds];
  }

  async claim(input: { id: string; now: Date }): Promise<ImportJob | null> {
    const job = this.jobs.get(input.id);
    if (!job) return null;
    const result = start(job, clockAt(input.now));
    if (!result.ok) return null;
    this.jobs.set(job.id, result.value);
    return result.value;
  }

  async markDone(input: {
    id: string;
    pageCount: number;
    pagesWithoutText: number;
    now: Date;
  }): Promise<ImportJob | null> {
    const job = this.jobs.get(input.id);
    if (!job) return null;
    const result = complete(
      job,
      { pageCount: input.pageCount, pagesWithoutText: input.pagesWithoutText },
      clockAt(input.now),
    );
    if (!result.ok) return null;
    this.jobs.set(job.id, result.value);
    return result.value;
  }

  async markFailed(input: {
    id: string;
    kind: ImportFailureKind;
    message: string;
    pageCount?: number;
    pagesWithoutText?: number;
    now: Date;
  }): Promise<ImportJob | null> {
    const job = this.jobs.get(input.id);
    if (!job) return null;
    const result = fail(
      job,
      {
        kind: input.kind,
        message: input.message,
        pageCount: input.pageCount,
        pagesWithoutText: input.pagesWithoutText,
      },
      clockAt(input.now),
    );
    if (!result.ok) return null;
    this.jobs.set(job.id, result.value);
    return result.value;
  }
}
