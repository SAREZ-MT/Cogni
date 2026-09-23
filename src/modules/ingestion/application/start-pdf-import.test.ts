import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { UPLOAD_GRANT_TTL_MS } from "../domain/pdf-file";
import { startPdfImport } from "./start-pdf-import";
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
// domain/pdf-file.test.ts so `startPdfImport` can control an upload
// grant's age without waiting on the real clock.
function uploadPath(ownerId: string, issuedAtMs: number): string {
  const hex = issuedAtMs.toString(16).padStart(12, "0");
  return `${ownerId}/${hex.slice(0, 8)}-${hex.slice(8, 12)}-7abc-89ab-000000000000.pdf`;
}

function makeDeps() {
  const notebookPages = new FakeNotebookPagesPort();
  notebookPages.addNotebook({ id: "nb-1", ownerId: OWNER_ID, active: true });
  return {
    notebookPages,
    storage: new FakePdfStorageGateway(),
    jobs: new InMemoryImportJobRepository(),
    clock: new FixedClock(NOW),
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
    if (!result.ok) expect(result.error.code).toBe("PDF_PATH_OUT_OF_SCOPE");
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
    if (!result.ok) expect(result.error.code).toBe("PDF_PATH_OUT_OF_SCOPE");
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
    if (!result.ok) expect(result.error.code).toBe("PDF_UPLOAD_EXPIRED");
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
    if (!result.ok) expect(result.error.code).toBe("PDF_OBJECT_MISSING");
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
    if (!result.ok) expect(result.error.code).toBe("PDF_MIME_NOT_ALLOWED");
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
    if (!result.ok) expect(result.error.code).toBe("PDF_TOO_LARGE");
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

  it("rejects malformed input", async () => {
    const deps = makeDeps();

    const result = await startPdfImport({}, deps, OWNER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INGESTION_INVALID_INPUT");
  });
});
