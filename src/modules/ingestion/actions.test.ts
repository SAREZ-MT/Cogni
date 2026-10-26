import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/shared/kernel/id";
import { FakeDocumentExtractor } from "./application/testing/fake-document-extractor";
import { FakeImportTelemetry } from "./application/testing/fake-import-telemetry";
import { FakeNotebookPagesPort } from "./application/testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "./application/testing/fake-pdf-storage-gateway";
import { InMemoryImportJobRepository } from "./application/testing/in-memory-import-job-repository";

// Session and adapters are mocked so this test proves the Server Action
// boundary (session, Zod validation, ActionError mapping, revalidatePath,
// the never-throw guarantee) without a real database or Supabase client —
// same pattern as notebooks/actions.test.ts. `env.server` is mocked
// instead of relying on real process.env so this file never needs a real
// SUPABASE_PDF_BUCKET.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/shared/config/env.server", () => ({
  serverEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    SUPABASE_PDF_BUCKET: "page-pdfs",
    NEXT_PUBLIC_POSTHOG_KEY: undefined,
    NEXT_PUBLIC_POSTHOG_HOST: undefined,
  }),
}));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

// T8 review follow-up (R3-actions-test-shared-mutable-fakes): every test
// gets its own fresh fake instances instead of sharing module-scoped ones,
// so a mutation in one test (e.g. a created job) can never leak into
// another. `vi.mock`'s factory can't close over per-test values, so the
// mocked "./infrastructure" module reads today's fakes off this holder,
// reset in beforeEach before each test builds its own.
let current: {
  notebookPages: FakeNotebookPagesPort;
  storage: FakePdfStorageGateway;
  jobs: InMemoryImportJobRepository;
  extractor: FakeDocumentExtractor;
  telemetry: FakeImportTelemetry;
};

vi.mock("./infrastructure", () => ({
  NotebooksPagesAdapter: vi.fn(function NotebooksPagesAdapter() {
    return current.notebookPages;
  }),
  SupabasePdfStorageGateway: vi.fn(function SupabasePdfStorageGateway() {
    return current.storage;
  }),
  DrizzleImportJobRepository: vi.fn(function DrizzleImportJobRepository() {
    return current.jobs;
  }),
  createDocumentExtractor: vi.fn(function createDocumentExtractor() {
    return current.extractor;
  }),
  ImportTelemetryAdapter: vi.fn(function ImportTelemetryAdapter() {
    return current.telemetry;
  }),
}));

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

// T8 review follow-up (R3-fresh-upload-path-collision): a counter keeps
// every call unique even when several run within the same millisecond, so
// two tests (or two calls in the same test) never collide on the same
// storagePath. A syntactically valid UUID v7 whose first 12 hex digits
// encode `issuedAtMs` as a big-endian 48-bit timestamp (mirrors the helper
// in application/start-pdf-import.test.ts), issued "now" so its age always
// stays under the 10-minute upload grant TTL regardless of when the test
// runs.
let uploadPathCounter = 0;
function freshUploadPath(ownerId: string): string {
  uploadPathCounter += 1;
  const hex = Date.now().toString(16).padStart(12, "0");
  const suffix = uploadPathCounter.toString(16).padStart(4, "0");
  return `${ownerId}/${hex.slice(0, 8)}-${suffix}-7abc-89ab-000000000000.pdf`;
}

describe("ingestion Server Actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    revalidatePath.mockClear();
    captureException.mockClear();
    current = {
      notebookPages: new FakeNotebookPagesPort(),
      storage: new FakePdfStorageGateway(),
      jobs: new InMemoryImportJobRepository(),
      extractor: new FakeDocumentExtractor(),
      telemetry: new FakeImportTelemetry(),
    };
    current.notebookPages.addNotebook({
      id: "nb-1",
      ownerId: OWNER_ID,
      active: true,
    });
  });

  describe("without a session", () => {
    beforeEach(() => getCurrentUser.mockResolvedValue(null));

    it("rejects requestPdfUpload with a session-required ActionError, without touching Storage", async () => {
      const { requestPdfUpload } = await import("./actions");

      const result = await requestPdfUpload({
        notebookId: "nb-1",
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INGESTION_SESSION_REQUIRED");
      }
      expect(current.storage.signedUploadUrlCalls).toHaveLength(0);
    });

    it("rejects startPdfImport with a session-required ActionError", async () => {
      const { startPdfImport } = await import("./actions");

      const result = await startPdfImport({
        notebookId: "nb-1",
        storagePath: "x/y.pdf",
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INGESTION_SESSION_REQUIRED");
      }
    });

    it("rejects processPdfImport with a session-required ActionError", async () => {
      const { processPdfImport } = await import("./actions");

      const result = await processPdfImport({ importJobId: "any" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INGESTION_SESSION_REQUIRED");
      }
    });

    it("rejects getImportJobStatus with a session-required ActionError", async () => {
      const { getImportJobStatus } = await import("./actions");

      const result = await getImportJobStatus({ pageId: "any" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INGESTION_SESSION_REQUIRED");
      }
    });

    it("rejects getActiveImports with a session-required ActionError", async () => {
      const { getActiveImports } = await import("./actions");

      const result = await getActiveImports();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INGESTION_SESSION_REQUIRED");
      }
    });
  });

  describe("with a session", () => {
    beforeEach(() => {
      getCurrentUser.mockResolvedValue({ id: OWNER_ID, email: "a@b.com" });
    });

    it("rejects malformed input as an ActionError instead of throwing", async () => {
      const { requestPdfUpload } = await import("./actions");

      const result = await requestPdfUpload({ notebookId: 123 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INGESTION_INVALID_INPUT");
      }
    });

    it("never accepts a binary payload in the schema (fileName/mime/sizeBytes are typed, no File/Blob field)", async () => {
      const { requestPdfUploadSchema } = await import("./application");

      expect(Object.keys(requestPdfUploadSchema.shape)).toEqual([
        "notebookId",
        "fileName",
        "mime",
        "sizeBytes",
      ]);
    });

    it("requestPdfUpload issues a signed upload grant to the owner's canonical path", async () => {
      const { requestPdfUpload } = await import("./actions");

      const result = await requestPdfUpload({
        notebookId: "nb-1",
        fileName: "Cálculo I.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.storagePath.startsWith(`${OWNER_ID}/`)).toBe(true);
        expect(result.value.signedUrl).toBeTruthy();
        expect(result.value.bucket).toBe("page-pdfs");
      }
    });

    // document-import T9b: the composition root wires a per-user upload
    // grant limiter (in memory here: no AI_PROVIDER_MODE=live).
    it("requestPdfUpload refuses with RATE_LIMITED after the hourly grant limit", async () => {
      // Its own user: the in-memory limiter lives for the whole file.
      const limitedOwner = "7a7a7a7a-1b1b-4c1c-8d1d-2e2e2e2e2e2e";
      getCurrentUser.mockResolvedValue({ id: limitedOwner, email: "l@b.com" });
      current.notebookPages.addNotebook({
        id: "nb-1",
        ownerId: limitedOwner,
        active: true,
      });
      const { requestPdfUpload } = await import("./actions");
      const request = () =>
        requestPdfUpload({
          notebookId: "nb-1",
          fileName: "a.pdf",
          mime: "application/pdf",
          sizeBytes: 1024,
        });
      let last = await request();
      for (let call = 1; call <= 20 && last.ok; call++) last = await request();

      expect(last.ok).toBe(false);
      if (!last.ok) expect(last.error.code).toBe("INGESTION_RATE_LIMITED");
    });

    it("startPdfImport responds in queued without extracting, and revalidates the sidebar", async () => {
      const path = freshUploadPath(OWNER_ID);
      current.storage.put(path, { sizeBytes: 2048, mime: "application/pdf" });
      const { startPdfImport } = await import("./actions");

      const result = await startPdfImport({
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.status).toBe("queued");
      expect(current.extractor.extractCalls).toHaveLength(0);
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("processPdfImport processes a queued job and returns its terminal ImportJobStatusView", async () => {
      const path = freshUploadPath(OWNER_ID);
      const bytes = new TextEncoder().encode("%PDF-1.4 fake");
      current.storage.put(path, {
        sizeBytes: bytes.length,
        mime: "application/pdf",
        bytes,
      });
      current.extractor.setResult({
        ok: true,
        value: {
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Un párrafo de texto." }],
              },
            ],
          },
          totalPages: 1,
          pagesWithoutText: 0,
          images: [],
          skippedImages: 0,
        },
      });
      const { startPdfImport, processPdfImport } = await import("./actions");
      const started = await startPdfImport({
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      });
      if (!started.ok) throw new Error("setup failed: startPdfImport rejected");

      const result = await processPdfImport({
        importJobId: started.value.importJobId,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("done");
        expect(result.value.importJobId).toBe(started.value.importJobId);
      }
    });

    it("getImportJobStatus returns null when the page has no import", async () => {
      const { getImportJobStatus } = await import("./actions");

      const result = await getImportJobStatus({ pageId: createId() });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBeNull();
    });

    it("maps a DomainError from the use case to an ActionError instead of throwing", async () => {
      const { startPdfImport } = await import("./actions");

      const result = await startPdfImport({
        notebookId: "nb-1",
        storagePath: "not-a-valid-path.pdf",
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      });

      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error.code).toBe("DOCUMENT_PATH_OUT_OF_SCOPE");
    });

    it("processPdfImport maps a not-found job to an ActionError instead of throwing", async () => {
      const { processPdfImport } = await import("./actions");

      const result = await processPdfImport({ importJobId: createId() });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("IMPORT_JOB_NOT_FOUND");
    });

    it("getActiveImports returns an empty array with no active imports", async () => {
      const { getActiveImports } = await import("./actions");

      const result = await getActiveImports();

      expect(result).toEqual({ ok: true, value: [] });
    });

    it("getActiveImports returns the page id of a job just started with startPdfImport", async () => {
      const path = freshUploadPath(OWNER_ID);
      current.storage.put(path, { sizeBytes: 2048, mime: "application/pdf" });
      const { startPdfImport, getActiveImports } = await import("./actions");
      const started = await startPdfImport({
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      });
      if (!started.ok) throw new Error("setup failed: startPdfImport rejected");

      const result = await getActiveImports();

      expect(result).toEqual({ ok: true, value: [started.value.pageId] });
    });

    it("getImportJobStatus maps a job owned by another user to an ActionError, without revealing it exists", async () => {
      const path = freshUploadPath(OWNER_ID);
      current.storage.put(path, { sizeBytes: 2048, mime: "application/pdf" });
      const { startPdfImport, getImportJobStatus } = await import("./actions");
      const started = await startPdfImport({
        notebookId: "nb-1",
        storagePath: path,
        fileName: "a.pdf",
        mime: "application/pdf",
        sizeBytes: 1024,
      });
      if (!started.ok) throw new Error("setup failed: startPdfImport rejected");

      getCurrentUser.mockResolvedValue({
        id: "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6",
        email: "other@b.com",
      });
      const result = await getImportJobStatus({ pageId: started.value.pageId });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("IMPORT_JOB_NOT_FOUND");
    });

    // T8 review follow-up (R3-actions-never-throw-unenforced): a thrown
    // dependency must never escape a Server Action; it degrades to a typed
    // ActionError and a Sentry report instead.
    describe("the never-throw boundary", () => {
      it("maps a thrown getCurrentUser to an unexpected ActionError and reports it to Sentry", async () => {
        getCurrentUser.mockRejectedValue(new Error("supabase down"));
        const { requestPdfUpload } = await import("./actions");

        const result = await requestPdfUpload({
          notebookId: "nb-1",
          fileName: "a.pdf",
          mime: "application/pdf",
          sizeBytes: 1024,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("INGESTION_UNEXPECTED");
        expect(captureException).toHaveBeenCalledWith(expect.any(Error));
      });

      it("maps a thrown use-case dependency in processPdfImport to an unexpected ActionError instead of crashing the long-running action", async () => {
        // findById is called before processImportJob's own try/catch
        // blocks start (those only guard download/extract/persist per
        // T6/T7b's hardening), so it is a real "leaks past the use case"
        // exception this boundary must still catch.
        const boom = new Error("repository connection dropped");
        current.jobs.findById = async () => {
          throw boom;
        };
        const { processPdfImport } = await import("./actions");

        const result = await processPdfImport({ importJobId: createId() });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("INGESTION_UNEXPECTED");
        expect(captureException).toHaveBeenCalledWith(boom);
      });

      it("maps a thrown listActivePageIds to an unexpected ActionError instead of crashing", async () => {
        const boom = new Error("repository connection dropped");
        current.jobs.listActivePageIds = async () => {
          throw boom;
        };
        const { getActiveImports } = await import("./actions");

        const result = await getActiveImports();

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("INGESTION_UNEXPECTED");
        expect(captureException).toHaveBeenCalledWith(boom);
      });
    });
  });
});
