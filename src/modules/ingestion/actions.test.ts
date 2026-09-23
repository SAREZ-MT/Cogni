import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/shared/kernel/id";
import { FakeImportTelemetry } from "./application/testing/fake-import-telemetry";
import { FakeNotebookPagesPort } from "./application/testing/fake-notebook-pages-port";
import { FakePdfStorageGateway } from "./application/testing/fake-pdf-storage-gateway";
import { FakePdfTextExtractor } from "./application/testing/fake-pdf-text-extractor";
import { InMemoryImportJobRepository } from "./application/testing/in-memory-import-job-repository";

// Session and adapters are mocked so this test proves the Server Action
// boundary (session, Zod validation, ActionError mapping, revalidatePath)
// without a real database or Supabase client — same pattern as
// notebooks/actions.test.ts. `env.server` is mocked instead of relying on
// real process.env so this file never needs a real SUPABASE_PDF_BUCKET.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

const notebookPages = new FakeNotebookPagesPort();
const storage = new FakePdfStorageGateway();
const jobs = new InMemoryImportJobRepository();
const extractor = new FakePdfTextExtractor();
const telemetry = new FakeImportTelemetry();

vi.mock("./infrastructure", () => ({
  NotebooksPagesAdapter: vi.fn(function NotebooksPagesAdapter() {
    return notebookPages;
  }),
  SupabasePdfStorageGateway: vi.fn(function SupabasePdfStorageGateway() {
    return storage;
  }),
  DrizzleImportJobRepository: vi.fn(function DrizzleImportJobRepository() {
    return jobs;
  }),
  UnpdfTextExtractor: vi.fn(function UnpdfTextExtractor() {
    return extractor;
  }),
  ImportTelemetryAdapter: vi.fn(function ImportTelemetryAdapter() {
    return telemetry;
  }),
}));

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

// A syntactically valid UUID v7 whose first 12 hex digits encode `issuedAtMs`
// as a big-endian 48-bit timestamp (mirrors the helper in
// application/start-pdf-import.test.ts), issued "now" so its age always
// stays under the 10-minute upload grant TTL regardless of when the test
// runs.
function freshUploadPath(ownerId: string): string {
  const hex = Date.now().toString(16).padStart(12, "0");
  return `${ownerId}/${hex.slice(0, 8)}-${hex.slice(8, 12)}-7abc-89ab-000000000000.pdf`;
}

describe("ingestion Server Actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    notebookPages.addNotebook({ id: "nb-1", ownerId: OWNER_ID, active: true });
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
      expect(storage.signedUploadUrlCalls).toHaveLength(0);
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

    it("startPdfImport responds in queued without extracting, and revalidates the sidebar", async () => {
      const { revalidatePath } = await import("next/cache");
      const path = freshUploadPath(OWNER_ID);
      storage.put(path, { sizeBytes: 2048, mime: "application/pdf" });
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
      expect(extractor.extractCalls).toHaveLength(0);
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("processPdfImport processes a queued job and returns its terminal ImportJobStatusView", async () => {
      const path = freshUploadPath(OWNER_ID);
      const bytes = new TextEncoder().encode("%PDF-1.4 fake");
      storage.put(path, {
        sizeBytes: bytes.length,
        mime: "application/pdf",
        bytes,
      });
      extractor.setResult({
        ok: true,
        value: {
          totalPages: 1,
          pages: ["Un encabezado\n\nUn párrafo de texto."],
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
      if (!result.ok) expect(result.error.code).toBe("PDF_PATH_OUT_OF_SCOPE");
    });

    it("processPdfImport maps a not-found job to an ActionError instead of throwing", async () => {
      const { processPdfImport } = await import("./actions");

      const result = await processPdfImport({ importJobId: createId() });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("IMPORT_JOB_NOT_FOUND");
    });

    it("getImportJobStatus maps a job owned by another user to an ActionError, without revealing it exists", async () => {
      const path = freshUploadPath(OWNER_ID);
      storage.put(path, { sizeBytes: 2048, mime: "application/pdf" });
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
  });
});
