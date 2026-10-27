import { describe, expect, it, vi } from "vitest";
import { isOwnedDocumentPath } from "../domain/document-file";
import { requestPdfUpload } from "./request-pdf-upload";
import { FakeImportRateLimiter } from "./testing/fake-import-rate-limiter";
import { FakeNotebookPagesPort } from "./testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "./testing/fake-pdf-storage-gateway";
import { FixedClock } from "./testing/fixed-clock";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function makeDeps() {
  const notebookPages = new FakeNotebookPagesPort();
  notebookPages.addNotebook({ id: "nb-1", ownerId: OWNER_ID, active: true });
  return {
    notebookPages,
    storage: new FakePdfStorageGateway(),
    clock: new FixedClock(NOW),
    uploadLimiter: new FakeImportRateLimiter(),
  };
}

// specs/pdf-import/spec.md; design.md, "Decision: Flujo de subida y
// procesamiento", step 1 ("requestPdfUpload").
describe("requestPdfUpload use case", () => {
  it("issues a signed upload grant to the canonical {ownerId}/{uuid v7}.pdf path with a 10-minute expiry", async () => {
    const deps = makeDeps();

    const result = await requestPdfUpload(
      {
        notebookId: "nb-1",
        fileName: "Cálculo I.pdf",
        mime: "application/pdf",
        sizeBytes: 1_048_576,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isOwnedDocumentPath(OWNER_ID, result.value.storagePath)).toBe(true);
    expect(result.value.signedUrl).toContain(result.value.storagePath);
    expect(result.value.token).toBeTruthy();
    expect(result.value.bucket).toBeTruthy();
    expect(result.value.expiresAt).toBe(
      new Date(NOW.getTime() + 10 * 60 * 1000).toISOString(),
    );
    expect(deps.storage.signedUploadUrlCalls).toEqual([
      result.value.storagePath,
    ]);
  });

  // document-import T5: the same use case now issues grants for Word and
  // PowerPoint files; the path's extension records the declared format so
  // processImportJob can check the downloaded bytes against it.
  it.each([
    [
      "Apuntes.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".docx",
    ],
    [
      "Clase 4.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".pptx",
    ],
  ])("issues a grant for %s to a path ending in its format's extension", async (fileName, mime, extension) => {
    const deps = makeDeps();

    const result = await requestPdfUpload(
      { notebookId: "nb-1", fileName, mime, sizeBytes: 1_048_576 },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.storagePath.endsWith(extension)).toBe(true);
    expect(isOwnedDocumentPath(OWNER_ID, result.value.storagePath)).toBe(true);
  });

  it("rejects an empty file name without contacting Storage", async () => {
    const deps = makeDeps();

    const result = await requestPdfUpload(
      {
        notebookId: "nb-1",
        fileName: "   ",
        mime: "application/pdf",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe("DOCUMENT_FILE_NAME_INVALID");
    expect(deps.storage.signedUploadUrlCalls).toHaveLength(0);
  });

  it("rejects a non-document mime type without contacting Storage", async () => {
    const deps = makeDeps();

    const result = await requestPdfUpload(
      {
        notebookId: "nb-1",
        fileName: "a.pdf",
        mime: "image/png",
        sizeBytes: 1024,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_MIME_NOT_ALLOWED");
    expect(deps.storage.signedUploadUrlCalls).toHaveLength(0);
  });

  it("rejects an oversized file without contacting Storage", async () => {
    const deps = makeDeps();

    const result = await requestPdfUpload(
      {
        notebookId: "nb-1",
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 20_971_521,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_TOO_LARGE");
    expect(deps.storage.signedUploadUrlCalls).toHaveLength(0);
  });

  it("rejects a notebook owned by another user without contacting Storage", async () => {
    const deps = makeDeps();

    const result = await requestPdfUpload(
      {
        notebookId: "nb-1",
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
    expect(deps.storage.signedUploadUrlCalls).toHaveLength(0);
  });

  it("rejects an archived notebook without contacting Storage", async () => {
    const deps = makeDeps();
    deps.notebookPages.addNotebook({
      id: "nb-archived",
      ownerId: OWNER_ID,
      active: false,
    });

    const result = await requestPdfUpload(
      {
        notebookId: "nb-archived",
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
    expect(deps.storage.signedUploadUrlCalls).toHaveLength(0);
  });

  it("rejects malformed input", async () => {
    const deps = makeDeps();

    const result = await requestPdfUpload({}, deps, OWNER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INGESTION_INVALID_INPUT");
  });

  // T7c review follow-up (R3-metadata-throw-callers-unproved), T8: a thrown
  // createSignedUploadUrl (e.g. PdfStorageAdapterError from
  // SupabasePdfStorageGateway) must resolve to a typed failure instead of
  // propagating out of the use case.
  it("maps a thrown createSignedUploadUrl to INGESTION_STORAGE_UNAVAILABLE", async () => {
    const deps = makeDeps();
    deps.storage.forceNextCreateSignedUploadUrlError(
      new Error("transient storage failure"),
    );

    const result = await requestPdfUpload(
      {
        notebookId: "nb-1",
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
  });

  // T8 review follow-up (R3-storage-unavailable-discards-cause).
  it("keeps the original createSignedUploadUrl exception as cause and logs it", async () => {
    const deps = makeDeps();
    const original = new Error("transient storage failure");
    deps.storage.forceNextCreateSignedUploadUrlError(original);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const result = await requestPdfUpload(
        {
          notebookId: "nb-1",
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
        expect.stringContaining("createSignedUploadUrl"),
        original,
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  // document-import T9b (audit: no import rate limit): every upload grant
  // counts against the owner's hourly grant limit, before Storage is
  // contacted.
  it("refuses with RATE_LIMITED, issuing no grant, when the owner's upload limit is spent", async () => {
    const deps = makeDeps();
    deps.uploadLimiter.refuse();
    const createSignedUploadUrl = vi.spyOn(
      deps.storage,
      "createSignedUploadUrl",
    );

    const result = await requestPdfUpload(
      {
        notebookId: "nb-1",
        fileName: "notas.pdf",
        mime: "application/pdf",
        sizeBytes: 2048,
      },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INGESTION_RATE_LIMITED");
    expect(deps.uploadLimiter.consumed).toEqual([OWNER_ID]);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("does not consume the upload limit for an invalid request", async () => {
    const deps = makeDeps();

    await requestPdfUpload(
      { notebookId: "nb-1", fileName: "notas.exe", mime: "x", sizeBytes: 1 },
      deps,
      OWNER_ID,
    );

    expect(deps.uploadLimiter.consumed).toEqual([]);
  });
});
