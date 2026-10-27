import { describe, expect, it } from "vitest";
import type { Clock } from "@/shared/kernel/clock";
import { createImportJob } from "../domain/import-job";
import { getActiveImports } from "./get-active-imports";
import { InMemoryImportJobRepository } from "./testing/in-memory-import-job-repository";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

// ImportJobRepository.listActivePageIds(ownerId) carries no injectable
// clock (only the in-memory fake's test-only extra `now` parameter does),
// so it always checks abandonment against the real wall clock — jobs here
// are created "now" (the real clock) rather than a fixed past instant, well
// inside ABANDONED_AFTER_MS (150 s) for the lifetime of this test file.
const realClock: Clock = { now: () => new Date() };

function makeJob(overrides: { id: string; ownerId: string; pageId: string }) {
  return createImportJob(
    {
      id: overrides.id,
      ownerId: overrides.ownerId,
      pageId: overrides.pageId,
      storagePath: `${overrides.ownerId}/${overrides.id}.pdf`,
      fileName: "notas.pdf",
      sizeBytes: 1024,
    },
    realClock,
  );
}

// design.md, "Decision: Vista de página ..." — listActiveImports(ownerId):
// page ids with a queued or processing, non-abandoned job of the caller,
// for the sidebar's ImportingPageBadge (T13a). A thin read-only wrapper
// over ImportJobRepository.listActivePageIds, which already owns every
// filtering rule (status, ownership, abandonment) — proven independently
// by in-memory-import-job-repository.test.ts and the DB smoke suite. No
// Result wrapper: this use case has no failure case of its own.
describe("getActiveImports use case", () => {
  it("returns an empty array when the caller has no import jobs", async () => {
    const jobs = new InMemoryImportJobRepository();

    const result = await getActiveImports({ jobs }, OWNER_ID);

    expect(result).toEqual([]);
  });

  it("returns the page ids of the caller's queued and processing jobs", async () => {
    const jobs = new InMemoryImportJobRepository();
    await jobs.create(
      makeJob({ id: "job-1", ownerId: OWNER_ID, pageId: "page-1" }),
    );
    const processing = makeJob({
      id: "job-2",
      ownerId: OWNER_ID,
      pageId: "page-2",
    });
    await jobs.create(processing);
    await jobs.claim({ id: processing.id, now: new Date() });

    const result = await getActiveImports({ jobs }, OWNER_ID);

    expect(new Set(result)).toEqual(new Set(["page-1", "page-2"]));
  });

  it("excludes another owner's jobs", async () => {
    const jobs = new InMemoryImportJobRepository();
    await jobs.create(
      makeJob({ id: "job-1", ownerId: OTHER_OWNER_ID, pageId: "page-1" }),
    );

    const result = await getActiveImports({ jobs }, OWNER_ID);

    expect(result).toEqual([]);
  });

  it("excludes a terminal (done) job", async () => {
    const jobs = new InMemoryImportJobRepository();
    const job = makeJob({ id: "job-1", ownerId: OWNER_ID, pageId: "page-1" });
    await jobs.create(job);
    await jobs.claim({ id: job.id, now: new Date() });
    await jobs.markDone({
      id: job.id,
      pageCount: 1,
      pagesWithoutText: 0,
      skippedImages: 0,
      now: new Date(),
    });

    const result = await getActiveImports({ jobs }, OWNER_ID);

    expect(result).toEqual([]);
  });
});
