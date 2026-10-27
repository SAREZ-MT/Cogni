import { describe, expect, it } from "vitest";
import {
  complete,
  createImportJob,
  type NewImportJob,
} from "../../domain/import-job";
import { InMemoryImportJobRepository } from "./in-memory-import-job-repository";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

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

describe("InMemoryImportJobRepository", () => {
  it("creates a job and finds it by id", async () => {
    const repo = new InMemoryImportJobRepository();
    const clock = { now: () => new Date("2026-09-23T10:00:00.000Z") };
    const job = createImportJob(newJobInput(), clock);

    const created = await repo.create(job);

    expect(created.ok).toBe(true);
    expect(await repo.findById(job.id)).toEqual(job);
  });

  // T6 review follow-up from T5 (R3-idempotency-check-then-act-race): the
  // real table has a unique constraint on storage_path (T1); this fake
  // must reject a duplicate the same way instead of silently overwriting.
  it("rejects a second create() with the same storagePath as a typed conflict, without overwriting the first job", async () => {
    const repo = new InMemoryImportJobRepository();
    const clock = { now: () => new Date("2026-09-23T10:00:00.000Z") };
    const storagePath = `${OWNER_ID}/upload-conflict.pdf`;
    const first = createImportJob(
      newJobInput({ id: "job-first", storagePath }),
      clock,
    );
    const second = createImportJob(
      newJobInput({ id: "job-second", storagePath }),
      clock,
    );

    const firstCreated = await repo.create(first);
    const secondCreated = await repo.create(second);

    expect(firstCreated.ok).toBe(true);
    expect(secondCreated.ok).toBe(false);
    if (!secondCreated.ok) {
      expect(secondCreated.error.code).toBe("IMPORT_JOB_STORAGE_PATH_CONFLICT");
    }
    expect(await repo.findByStoragePath(storagePath)).toEqual(first);
    expect(await repo.findById("job-second")).toBeNull();
  });

  it("returns null from findById for a missing job", async () => {
    const repo = new InMemoryImportJobRepository();
    expect(await repo.findById("missing")).toBeNull();
  });

  it("finds a job by its storage path", async () => {
    const repo = new InMemoryImportJobRepository();
    const clock = { now: () => new Date("2026-09-23T10:00:00.000Z") };
    const job = createImportJob(
      newJobInput({ storagePath: `${OWNER_ID}/upload-2.pdf` }),
      clock,
    );
    await repo.create(job);

    expect(await repo.findByStoragePath(`${OWNER_ID}/upload-2.pdf`)).toEqual(
      job,
    );
    expect(await repo.findByStoragePath("nowhere.pdf")).toBeNull();
  });

  it("finds the latest job for a page by createdAt, ignoring jobs for other pages", async () => {
    const repo = new InMemoryImportJobRepository();
    const older = createImportJob(
      newJobInput({
        id: "job-older",
        pageId: "page-1",
        storagePath: `${OWNER_ID}/upload-older.pdf`,
      }),
      { now: () => new Date("2026-09-23T09:00:00.000Z") },
    );
    const newer = createImportJob(
      newJobInput({
        id: "job-newer",
        pageId: "page-1",
        storagePath: `${OWNER_ID}/upload-newer.pdf`,
      }),
      { now: () => new Date("2026-09-23T10:00:00.000Z") },
    );
    const otherPage = createImportJob(
      newJobInput({
        id: "job-other-page",
        pageId: "page-2",
        storagePath: `${OWNER_ID}/upload-other.pdf`,
      }),
      { now: () => new Date("2026-09-23T11:00:00.000Z") },
    );
    // Inserted last but older than `newer`: proves the comparison keeps
    // the current latest instead of overwriting it with an earlier job
    // encountered later in iteration order.
    const evenOlder = createImportJob(
      newJobInput({
        id: "job-even-older",
        pageId: "page-1",
        storagePath: `${OWNER_ID}/upload-even-older.pdf`,
      }),
      { now: () => new Date("2026-09-23T08:00:00.000Z") },
    );
    await repo.create(older);
    await repo.create(newer);
    await repo.create(otherPage);
    await repo.create(evenOlder);

    expect(await repo.findLatestByPage("page-1")).toEqual(newer);
    // T9b: scoped to an owner, another owner's jobs are invisible.
    expect(await repo.findLatestByPage("page-1", OWNER_ID)).toEqual(newer);
    expect(await repo.findLatestByPage("page-1", "someone-else")).toBeNull();
  });

  it("returns null from findLatestByPage when the page has no jobs", async () => {
    const repo = new InMemoryImportJobRepository();
    expect(await repo.findLatestByPage("page-1")).toBeNull();
  });

  it("lists active (queued/processing, non-abandoned) page ids for the owner only", async () => {
    const repo = new InMemoryImportJobRepository();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const clock = { now: () => now };

    const queued = createImportJob(
      newJobInput({
        id: "job-queued",
        pageId: "page-queued",
        storagePath: `${OWNER_ID}/upload-queued.pdf`,
      }),
      clock,
    );
    const done = createImportJob(
      newJobInput({
        id: "job-done",
        pageId: "page-done",
        storagePath: `${OWNER_ID}/upload-done.pdf`,
      }),
      clock,
    );
    const doneResult = complete(
      { ...done, status: "processing", startedAt: now },
      { pageCount: 1, pagesWithoutText: 0 },
      clock,
    );
    if (!doneResult.ok) throw new Error("setup failed");
    const other = createImportJob(
      newJobInput({
        id: "job-other-owner",
        pageId: "page-other",
        ownerId: OTHER_OWNER_ID,
        storagePath: `${OTHER_OWNER_ID}/upload-1.pdf`,
      }),
      clock,
    );

    await repo.create(queued);
    await repo.create(doneResult.value);
    await repo.create(other);

    expect(await repo.listActivePageIds(OWNER_ID, now)).toEqual([
      "page-queued",
    ]);
  });

  it("defaults now to the real wall clock when not provided", async () => {
    const repo = new InMemoryImportJobRepository();
    const job = createImportJob(newJobInput({ pageId: "page-real-time" }), {
      now: () => new Date(),
    });
    await repo.create(job);

    expect(await repo.listActivePageIds(OWNER_ID)).toEqual(["page-real-time"]);
  });

  it("excludes a queued job that has gone abandoned", async () => {
    const repo = new InMemoryImportJobRepository();
    const createdAt = new Date("2026-09-23T10:00:00.000Z");
    const job = createImportJob(newJobInput(), { now: () => createdAt });
    await repo.create(job);

    const wayLater = new Date(createdAt.getTime() + 10 * 60 * 1000);

    expect(await repo.listActivePageIds(OWNER_ID, wayLater)).toEqual([]);
  });

  it("claims a queued job, transitioning it to processing", async () => {
    const repo = new InMemoryImportJobRepository();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const job = createImportJob(newJobInput(), { now: () => now });
    await repo.create(job);

    const claimed = await repo.claim({ id: job.id, now });

    expect(claimed?.status).toBe("processing");
    expect((await repo.findById(job.id))?.status).toBe("processing");
  });

  it("returns null from claim for a missing job", async () => {
    const repo = new InMemoryImportJobRepository();
    expect(await repo.claim({ id: "missing", now: new Date() })).toBeNull();
  });

  it("returns null from claim when the job is no longer queued", async () => {
    const repo = new InMemoryImportJobRepository();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const job = createImportJob(newJobInput(), { now: () => now });
    await repo.create(job);
    await repo.claim({ id: job.id, now });

    const secondClaim = await repo.claim({ id: job.id, now });

    expect(secondClaim).toBeNull();
  });

  it("marks a processing job done", async () => {
    const repo = new InMemoryImportJobRepository();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const job = createImportJob(newJobInput(), { now: () => now });
    await repo.create(job);
    await repo.claim({ id: job.id, now });

    const done = await repo.markDone({
      id: job.id,
      pageCount: 3,
      pagesWithoutText: 0,
      skippedImages: 0,
      now,
    });

    expect(done?.status).toBe("done");
    expect((await repo.findById(job.id))?.pageCount).toBe(3);
  });

  it("returns null from markDone for a missing job", async () => {
    const repo = new InMemoryImportJobRepository();
    expect(
      await repo.markDone({
        id: "missing",
        pageCount: 1,
        pagesWithoutText: 0,
        skippedImages: 0,
        now: new Date(),
      }),
    ).toBeNull();
  });

  it("returns null from markDone when the job is still queued (invalid transition)", async () => {
    const repo = new InMemoryImportJobRepository();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const job = createImportJob(newJobInput(), { now: () => now });
    await repo.create(job);

    const result = await repo.markDone({
      id: job.id,
      pageCount: 1,
      pagesWithoutText: 0,
      skippedImages: 0,
      now,
    });

    expect(result).toBeNull();
  });

  it("marks a processing job failed", async () => {
    const repo = new InMemoryImportJobRepository();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const job = createImportJob(newJobInput(), { now: () => now });
    await repo.create(job);
    await repo.claim({ id: job.id, now });

    const failed = await repo.markFailed({
      id: job.id,
      kind: "download",
      message: "boom",
      now,
    });

    expect(failed?.status).toBe("failed");
    expect((await repo.findById(job.id))?.error).toBe("boom");
  });

  it("marks a queued job failed for a timeout", async () => {
    const repo = new InMemoryImportJobRepository();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const job = createImportJob(newJobInput(), { now: () => now });
    await repo.create(job);

    const failed = await repo.markFailed({
      id: job.id,
      kind: "timeout",
      message: "too slow",
      now,
    });

    expect(failed?.status).toBe("failed");
  });

  it("returns null from markFailed for a missing job", async () => {
    const repo = new InMemoryImportJobRepository();
    expect(
      await repo.markFailed({
        id: "missing",
        kind: "download",
        message: "boom",
        now: new Date(),
      }),
    ).toBeNull();
  });

  it("returns null from markFailed for an empty message (invalid transition)", async () => {
    const repo = new InMemoryImportJobRepository();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const job = createImportJob(newJobInput(), { now: () => now });
    await repo.create(job);
    await repo.claim({ id: job.id, now });

    const result = await repo.markFailed({
      id: job.id,
      kind: "download",
      message: "   ",
      now,
    });

    expect(result).toBeNull();
  });
});
