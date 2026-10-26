import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err } from "@/shared/kernel/result";
import { UPLOAD_GRANT_TTL_MS } from "../domain/document-file";
import { IMPORT_JOB_ERROR } from "../domain/errors";
import { createImportJob } from "../domain/import-job";
import { MAX_ACTIVE_IMPORTS } from "../domain/import-rate-limiter";
import { startPdfImport } from "./start-pdf-import";
import { FakeImportRateLimiter } from "./testing/fake-import-rate-limiter";
import { FakeNotebookPagesPort } from "./testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "./testing/fake-pdf-storage-gateway";
import { FixedClock } from "./testing/fixed-clock";
import { InMemoryImportJobRepository } from "./testing/in-memory-import-job-repository";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

// A syntactically valid UUID v7 (version nibble "7", RFC 4122 variant "8")
// whose first 12 hex digits encode `ms` as a big-endian 48-bit timestamp,
// matching how `@/shared/kernel/id.ts`'s `createId()` lays out bytes 0-5
// (design.md: "uploadId = createId()"). Mirrors the helper in
// domain/document-file.test.ts so `startPdfImport` can control an upload
// grant's age without waiting on the real clock.
function uploadPath(
  ownerId: string,
  issuedAtMs: number,
  extension = "pdf",
): string {
  const hex = issuedAtMs.toString(16).padStart(12, "0");
  return `${ownerId}/${hex.slice(0, 8)}-${hex.slice(8, 12)}-7abc-89ab-000000000000.${extension}`;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function makeDeps() {
  const notebookPages = new FakeNotebookPagesPort();
  notebookPages.addNotebook({ id: "nb-1", ownerId: OWNER_ID, active: true });
  return {
    notebookPages,
    storage: new FakePdfStorageGateway(),
    jobs: new InMemoryImportJobRepository(),
    clock: new FixedClock(NOW),
    startLimiter: new FakeImportRateLimiter(),
  };
}

function seedObject(deps: ReturnType<typeof makeDeps>, path: string) {
  deps.storage.put(path, { sizeBytes: 2048, mime: "application/pdf" });
}

// specs/pdf-import/spec.md; design.md, "Decision: Flujo de subida y
// procesamiento", step 3 ("startPdfImport").
describe("startPdfImport use case", () => {
  it("creates the page and a queued ImportJob from the real object metadata (Scenario: Importación iniciada)", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "Cálculo I - unidad 3.pdf",
        mime: "application/pdf",
        sizeBytes: 999, // client-declared, must be ignored in favor of real metadata
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.notebookId).toBe("nb-1");
    expect(result.value.status).toBe("queued");

    expect(deps.notebookPages.createPageCalls).toEqual([
      {
        ownerId: OWNER_ID,
        notebookId: "nb-1",
        title: "Cálculo I - unidad 3",
      },
    ]);

    const job = await deps.jobs.findById(result.value.importJobId);
    expect(job).toMatchObject({
      ownerId: OWNER_ID,
      pageId: result.value.pageId,
      storagePath: path,
      fileName: "Cálculo I - unidad 3.pdf",
      sizeBytes: 2048, // from the real object, not the client-declared 999
      status: "queued",
    });
  });

  it("starts a docx import whose stored object is a Word document, titling the page without .docx", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime(), "docx");
    deps.storage.put(path, { sizeBytes: 4096, mime: DOCX_MIME });

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "Apuntes de clase.docx",
        mime: DOCX_MIME,
        sizeBytes: 4096,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    expect(deps.notebookPages.createPageCalls[0]?.title).toBe(
      "Apuntes de clase",
    );
    // document-import T10: the job records the verified format.
    const job = await deps.jobs.findByStoragePath(path);
    expect(job?.format).toBe("docx");
  });

  it("rejects a stored object whose real mime does not match the path's declared format, before creating a page", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime(), "docx");
    deps.storage.put(path, { sizeBytes: 4096, mime: "application/pdf" });

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "Apuntes.docx",
        mime: DOCX_MIME,
        sizeBytes: 4096,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOCUMENT_UNSUPPORTED_FORMAT");
    }
    expect(deps.notebookPages.createPageCalls).toHaveLength(0);
  });

  it("falls back to the default page title when the file name leaves nothing after stripping", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: ".pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    expect(deps.notebookPages.createPageCalls[0]?.title).toBeUndefined();
  });

  it("is idempotent by storagePath: a repeated call returns the existing job without creating a new page or job", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);
    const input = {
      notebookId: "nb-1",
      storagePath: path,
      fileName: "a.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    };

    const first = await startPdfImport(input, deps, OWNER_ID);
    const second = await startPdfImport(input, deps, OWNER_ID);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value).toEqual(first.value);
    expect(deps.notebookPages.createPageCalls).toHaveLength(1);
    expect(deps.storage.getObjectMetadataCalls).toHaveLength(1);
  });

  // Review follow-up from T3 (idempotency must be checked before the
  // expiry check): a job created while the grant was fresh must still be
  // returned by a repeated call after the grant would now read as
  // expired.
  it("checks idempotency before the expiry check: an existing job is returned even after the grant would now read as expired", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);
    const input = {
      notebookId: "nb-1",
      storagePath: path,
      fileName: "a.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    };

    const first = await startPdfImport(input, deps, OWNER_ID);
    deps.clock.advanceMs(UPLOAD_GRANT_TTL_MS + 60_000);
    const second = await startPdfImport(input, deps, OWNER_ID);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.importJobId).toBe(first.value.importJobId);
  });

  // T6 review follow-up from T5 (R3-idempotent-notebookid-echoed-from-
  // input): the idempotent path must echo the existing job's *real*
  // notebookId, not blindly trust the caller's input.
  it("rejects the idempotent path when the input notebookId no longer matches the existing job's real notebook", async () => {
    const deps = makeDeps();
    deps.notebookPages.addNotebook({
      id: "nb-2",
      ownerId: OWNER_ID,
      active: true,
    });
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);
    const first = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );
    expect(first.ok).toBe(true);

    const second = await startPdfImport(
      {
        notebookId: "nb-2",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("INGESTION_NOTEBOOK_MISMATCH");
    }
  });

  // T7b review follow-up from T6 (R3-idempotent-null-page-reported-as-
  // mismatch): a null findPageNotebookId (page missing/archived/unowned)
  // must surface as a distinct page-not-found error, not a notebook
  // mismatch.
  it("returns a page-not-found error on the idempotent path when the existing job's page is no longer available", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);
    const input = {
      notebookId: "nb-1",
      storagePath: path,
      fileName: "a.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    };
    const first = await startPdfImport(input, deps, OWNER_ID);
    expect(first.ok).toBe(true);
    vi.spyOn(deps.notebookPages, "findPageNotebookId").mockResolvedValueOnce(
      null,
    );

    const second = await startPdfImport(input, deps, OWNER_ID);

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("INGESTION_PAGE_NOT_FOUND");
    }
  });

  // T6 review follow-up from T5 (R3-idempotency-check-then-act-race):
  // ImportJobRepository.create surfaces a storage_path conflict as a typed
  // result instead of throwing; startPdfImport resolves it by re-fetching
  // the concurrent winner instead of leaking the conflict to the caller.
  it("resolves a create() storagePath race to the concurrent winner's job, echoing the winner's real notebookId", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);

    vi.spyOn(deps.jobs, "findByStoragePath").mockResolvedValueOnce(null);
    const realCreate = deps.jobs.create.bind(deps.jobs);
    let winnerId: string | undefined;
    vi.spyOn(deps.jobs, "create").mockImplementationOnce(async (job) => {
      // Simulate a concurrent startPdfImport call winning the race for the
      // same storagePath a moment before this call's own create().
      const winnerPage = await deps.notebookPages.createPage(OWNER_ID, {
        notebookId: "nb-1",
      });
      if (!winnerPage.ok) throw new Error("setup failed");
      const winner = createImportJob(
        {
          id: "job-winner",
          ownerId: OWNER_ID,
          pageId: winnerPage.value.id,
          storagePath: job.storagePath,
          fileName: "winner.pdf",
          sizeBytes: 2048,
        },
        deps.clock,
      );
      await realCreate(winner);
      winnerId = winner.id;
      return err(
        new DomainError(
          IMPORT_JOB_ERROR.STORAGE_PATH_CONFLICT,
          job.storagePath,
        ),
      );
    });

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "loser.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.importJobId).toBe(winnerId);
    expect(result.value.notebookId).toBe("nb-1");
    // The loser's own page (created before the race was discovered)
    // becomes an orphan — accepted risk per design.md's non-atomic
    // "página → job" ordering — but no second job for this storagePath
    // exists.
    expect(deps.notebookPages.createPageCalls).toHaveLength(2);
  });

  it("surfaces the raw conflict when the concurrent winner cannot be found after a create() race (defensive)", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);
    const conflict = new DomainError(
      IMPORT_JOB_ERROR.STORAGE_PATH_CONFLICT,
      path,
    );
    vi.spyOn(deps.jobs, "create").mockResolvedValueOnce(err(conflict));
    vi.spyOn(deps.jobs, "findByStoragePath")
      .mockResolvedValueOnce(null) // the pre-create idempotency check
      .mockResolvedValueOnce(null); // the post-conflict winner lookup

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result).toEqual({ ok: false, error: conflict });
  });

  it("rejects a path owned by someone else without touching the repository or Storage (Scenario: Ruta fuera del alcance)", async () => {
    const deps = makeDeps();
    const path = uploadPath(OTHER_OWNER_ID, NOW.getTime());

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe("DOCUMENT_PATH_OUT_OF_SCOPE");
    expect(deps.storage.getObjectMetadataCalls).toHaveLength(0);
    expect(deps.notebookPages.createPageCalls).toHaveLength(0);
  });

  it("rejects a malformed path without touching the repository or Storage", async () => {
    const deps = makeDeps();

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: `${OWNER_ID}/../etc-passwd.pdf`,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe("DOCUMENT_PATH_OUT_OF_SCOPE");
  });

  it("rejects an upload grant older than 10 minutes when no job exists yet (C3)", async () => {
    const deps = makeDeps();
    const path = uploadPath(
      OWNER_ID,
      NOW.getTime() - (UPLOAD_GRANT_TTL_MS + 1),
    );

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UPLOAD_EXPIRED");
    expect(deps.storage.getObjectMetadataCalls).toHaveLength(0);
  });

  it("accepts an upload grant exactly at the 10-minute boundary", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime() - UPLOAD_GRANT_TTL_MS);
    seedObject(deps, path);

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a notebook owned by another user (Scenario: Cuaderno ajeno)", async () => {
    const deps = makeDeps();
    const path = uploadPath(OTHER_OWNER_ID, NOW.getTime());

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INGESTION_NOTEBOOK_NOT_FOUND");
    }
    expect(deps.storage.getObjectMetadataCalls).toHaveLength(0);
  });

  it("rejects an archived notebook", async () => {
    const deps = makeDeps();
    deps.notebookPages.addNotebook({
      id: "nb-archived",
      ownerId: OWNER_ID,
      active: false,
    });
    const path = uploadPath(OWNER_ID, NOW.getTime());

    const result = await startPdfImport(
      {
        notebookId: "nb-archived",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INGESTION_NOTEBOOK_NOT_FOUND");
    }
  });

  it("rejects a missing object in Storage (Scenario: Objeto inexistente)", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_OBJECT_MISSING");
    expect(deps.notebookPages.createPageCalls).toHaveLength(0);
  });

  it("rejects an object whose real mime does not match application/pdf", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    deps.storage.put(path, { sizeBytes: 1024, mime: "image/png" });

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_MIME_NOT_ALLOWED");
    expect(deps.notebookPages.createPageCalls).toHaveLength(0);
  });

  it("rejects an object whose real size exceeds the limit", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    deps.storage.put(path, {
      sizeBytes: 20_971_521,
      mime: "application/pdf",
    });

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_TOO_LARGE");
  });

  it("propagates a page-creation failure without creating a job", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);
    const forced = new DomainError("NOTEBOOK_ARCHIVED", "race condition");
    deps.notebookPages.forceNextCreatePageError(forced);

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(forced);
    expect(await deps.jobs.findByStoragePath(path)).toBeNull();
  });

  // document-import T10 (T9b review): the early count can race another
  // start; the repository's atomic cap is the real guard.
  it("refuses with RATE_LIMITED when the atomic cap in create() wins a race the early count missed", async () => {
    const deps = makeDeps();
    for (let index = 0; index < 3; index++) {
      await deps.jobs.create(
        createImportJob(
          {
            id: `active-${index}`,
            ownerId: OWNER_ID,
            pageId: `page-${index}`,
            storagePath: `${OWNER_ID}/active-${index}.pdf`,
            fileName: "otro.pdf",
            sizeBytes: 1,
          },
          { now: () => NOW },
        ),
      );
    }
    vi.spyOn(deps.jobs, "countActiveJobs").mockResolvedValueOnce(0);
    const path = uploadPath(OWNER_ID, NOW.getTime());
    seedObject(deps, path);

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "apuntes.pdf",
        mime: "application/pdf",
        sizeBytes: 2048,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INGESTION_RATE_LIMITED");
    expect(await deps.jobs.findByStoragePath(path)).toBeNull();
  });

  it("rejects malformed input", async () => {
    const deps = makeDeps();

    const result = await startPdfImport({}, deps, OWNER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INGESTION_INVALID_INPUT");
  });

  // T7c review follow-up (R3-metadata-throw-callers-unproved), T8: a thrown
  // getObjectMetadata (e.g. PdfStorageAdapterError for a transient Supabase
  // failure) must resolve to a typed failure — never leak an exception out
  // of the use case, and never create a page for an object it could not
  // verify.
  it("maps a thrown getObjectMetadata to INGESTION_STORAGE_UNAVAILABLE without creating a page", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    deps.storage.forceNextGetObjectMetadataError(
      new Error("transient storage failure"),
    );

    const result = await startPdfImport(
      {
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INGESTION_STORAGE_UNAVAILABLE");
    }
    expect(deps.notebookPages.createPageCalls).toHaveLength(0);
    expect(await deps.jobs.findByStoragePath(path)).toBeNull();
  });

  // T8 review follow-up (R3-storage-unavailable-discards-cause).
  it("keeps the original getObjectMetadata exception as cause and logs it", async () => {
    const deps = makeDeps();
    const path = uploadPath(OWNER_ID, NOW.getTime());
    const original = new Error("transient storage failure");
    deps.storage.forceNextGetObjectMetadataError(original);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const result = await startPdfImport(
        {
          notebookId: "nb-1",
          storagePath: path,
          fileName: "a.pdf",
          mime: "application/pdf",
          sizeBytes: 1024,
        },
        deps,
        OWNER_ID,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as { cause?: unknown }).cause).toBe(original);
      }
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("getObjectMetadata"),
        original,
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  // document-import T9b (audit: no import rate limit or concurrency cap).
  describe("limits", () => {
    const input = (path: string) => ({
      notebookId: "nb-1",
      storagePath: path,
      fileName: "notas.pdf",
      mime: "application/pdf",
      sizeBytes: 2048,
    });

    it("refuses with RATE_LIMITED, creating nothing, when the owner's start limit is spent", async () => {
      const deps = makeDeps();
      const path = uploadPath(OWNER_ID, NOW.getTime());
      seedObject(deps, path);
      deps.startLimiter.refuse();

      const result = await startPdfImport(input(path), deps, OWNER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INGESTION_RATE_LIMITED");
      expect(deps.startLimiter.consumed).toEqual([OWNER_ID]);
      expect(deps.notebookPages.createPageCalls).toEqual([]);
      expect(await deps.jobs.findByStoragePath(path)).toBeNull();
    });

    it("refuses with RATE_LIMITED, without consuming the limit, while the owner has 3 imports in flight", async () => {
      const deps = makeDeps();
      for (let index = 0; index < MAX_ACTIVE_IMPORTS; index++) {
        await deps.jobs.create(
          createImportJob(
            {
              id: `active-${index}`,
              ownerId: OWNER_ID,
              pageId: `page-${index}`,
              storagePath: uploadPath(OWNER_ID, NOW.getTime() - index - 1),
              fileName: "a.pdf",
              sizeBytes: 1,
            },
            deps.clock,
          ),
        );
      }
      const path = uploadPath(OWNER_ID, NOW.getTime());
      seedObject(deps, path);

      const result = await startPdfImport(input(path), deps, OWNER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INGESTION_RATE_LIMITED");
      expect(deps.startLimiter.consumed).toEqual([]);
      expect(deps.notebookPages.createPageCalls).toEqual([]);
      expect(MAX_ACTIVE_IMPORTS).toBe(3);
    });

    it("lets another owner start while one owner is at the cap", async () => {
      const deps = makeDeps();
      deps.notebookPages.addNotebook({
        id: "nb-2",
        ownerId: OTHER_OWNER_ID,
        active: true,
      });
      for (let index = 0; index < MAX_ACTIVE_IMPORTS; index++) {
        await deps.jobs.create(
          createImportJob(
            {
              id: `active-${index}`,
              ownerId: OWNER_ID,
              pageId: `page-${index}`,
              storagePath: uploadPath(OWNER_ID, NOW.getTime() - index - 1),
              fileName: "a.pdf",
              sizeBytes: 1,
            },
            deps.clock,
          ),
        );
      }
      const path = uploadPath(OTHER_OWNER_ID, NOW.getTime());
      seedObject(deps, path);

      const result = await startPdfImport(
        { ...input(path), notebookId: "nb-2" },
        deps,
        OTHER_OWNER_ID,
      );

      expect(result.ok).toBe(true);
    });

    // document-import T10 (T9b review): a start refused by the storage
    // checks (missing object, wrong mime, too large, transient error)
    // must not spend one of the owner's hourly starts.
    it.each([
      ["a missing object", () => undefined],
      [
        "an object whose real mime is not allowed",
        (deps: ReturnType<typeof makeDeps>, path: string) =>
          deps.storage.put(path, { sizeBytes: 2048, mime: "text/plain" }),
      ],
      [
        "an object over the size limit",
        (deps: ReturnType<typeof makeDeps>, path: string) =>
          deps.storage.put(path, {
            sizeBytes: 21 * 1024 * 1024,
            mime: "application/pdf",
          }),
      ],
      [
        "an object whose mime is not the path's format",
        (deps: ReturnType<typeof makeDeps>, path: string) =>
          deps.storage.put(path, { sizeBytes: 2048, mime: DOCX_MIME }),
      ],
      [
        "a Storage error",
        (deps: ReturnType<typeof makeDeps>) => {
          vi.spyOn(deps.storage, "getObjectMetadata").mockRejectedValueOnce(
            new Error("503"),
          );
          vi.spyOn(console, "error").mockImplementation(() => {});
        },
      ],
    ] as const)("does not consume the start limit for %s", async (_case, seed) => {
      const deps = makeDeps();
      const path = uploadPath(OWNER_ID, NOW.getTime());
      seed(deps, path);

      const result = await startPdfImport(input(path), deps, OWNER_ID);

      expect(result.ok).toBe(false);
      expect(deps.startLimiter.consumed).toEqual([]);
      vi.restoreAllMocks();
    });

    it("does not consume the limit for an idempotent repeat of a started import", async () => {
      const deps = makeDeps();
      const path = uploadPath(OWNER_ID, NOW.getTime());
      seedObject(deps, path);

      await startPdfImport(input(path), deps, OWNER_ID);
      const repeat = await startPdfImport(input(path), deps, OWNER_ID);

      expect(repeat.ok).toBe(true);
      expect(deps.startLimiter.consumed).toEqual([OWNER_ID]);
    });
  });
});
