import { describe, expect, it, vi } from "vitest";
import {
  PdfStorageAdapterError,
  SupabasePdfStorageGateway,
} from "./supabase-pdf-storage-gateway";

// vitest runs in jsdom, not Next.js's "react-server" condition, so the
// real `server-only` package throws on import outside a Server Component
// build; every other adapter test in this codebase avoids importing a
// file with `import "server-only"` directly (see env.test.ts, which tests
// env.schema.ts instead of env.server.ts) — this is the one that needs
// the real class under test, so the package is stubbed here instead. This
// works because vi.mock() calls are hoisted above all imports.
vi.mock("server-only", () => ({}));

// SupabasePdfStorageGateway (design.md, "ingestion define su propio
// PdfStorageGateway y el adaptador SupabasePdfStorageGateway... recibe
// { supabaseUrl, serviceRoleKey, bucket } por constructor, sin leer
// variables de entorno") wraps the Supabase Storage client for the private
// `page-pdfs` bucket. `createClient` is mocked so this proves the
// adapter's own translation logic, not the Supabase SDK.
const createSignedUploadUrl = vi.fn();
const info = vi.fn();
const download = vi.fn();
const from = vi.fn(() => ({ createSignedUploadUrl, info, download }));
const createClient = vi.fn((..._args: unknown[]) => ({ storage: { from } }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

const CONFIG = {
  supabaseUrl: "https://project.supabase.co",
  serviceRoleKey: "service-role-key",
  bucket: "page-pdfs",
};

describe("SupabasePdfStorageGateway", () => {
  it("builds the client from the given config, never reading env directly", async () => {
    info.mockResolvedValueOnce({ data: null, error: null });
    const gateway = new SupabasePdfStorageGateway(CONFIG);

    expect(createClient).toHaveBeenCalledWith(
      CONFIG.supabaseUrl,
      CONFIG.serviceRoleKey,
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
      }),
    );

    await gateway.getObjectMetadata("owner-1/x.pdf");
    expect(from).toHaveBeenCalledWith("page-pdfs");
  });

  describe("createSignedUploadUrl", () => {
    it("returns the signed url, token and bucket on success", async () => {
      createSignedUploadUrl.mockResolvedValueOnce({
        data: { signedUrl: "https://signed.local/x", token: "tok" },
        error: null,
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      const grant = await gateway.createSignedUploadUrl("owner-1/x.pdf");

      expect(grant).toEqual({
        signedUrl: "https://signed.local/x",
        token: "tok",
        bucket: "page-pdfs",
      });
      expect(createSignedUploadUrl).toHaveBeenCalledWith("owner-1/x.pdf");
    });

    it("throws a typed PdfStorageAdapterError, never the raw Supabase error", async () => {
      const rawError = { message: "internal supabase detail", status: 500 };
      createSignedUploadUrl.mockResolvedValueOnce({
        data: null,
        error: rawError,
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      await expect(
        gateway.createSignedUploadUrl("owner-1/x.pdf"),
      ).rejects.toBeInstanceOf(PdfStorageAdapterError);
      try {
        await gateway.createSignedUploadUrl("owner-1/x.pdf");
      } catch (error) {
        expect(error).not.toBe(rawError);
        expect((error as Error).message).not.toContain("internal supabase");
      }
    });
  });

  describe("getObjectMetadata", () => {
    it("returns size and mime for an existing object", async () => {
      info.mockResolvedValueOnce({
        data: { size: 2048, contentType: "application/pdf" },
        error: null,
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      const metadata = await gateway.getObjectMetadata("owner-1/x.pdf");

      expect(metadata).toEqual({ sizeBytes: 2048, mime: "application/pdf" });
    });

    it("returns null (never throws) when the object does not exist", async () => {
      info.mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      const metadata = await gateway.getObjectMetadata("owner-1/x.pdf");

      expect(metadata).toBeNull();
    });

    it("returns null when the response is missing size or contentType", async () => {
      info.mockResolvedValueOnce({
        data: { size: undefined, contentType: "application/pdf" },
        error: null,
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      const metadata = await gateway.getObjectMetadata("owner-1/x.pdf");

      expect(metadata).toBeNull();
    });
  });

  describe("download", () => {
    it("returns the object's bytes on success", async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3])]);
      download.mockResolvedValueOnce({ data: blob, error: null });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      const bytes = await gateway.download("owner-1/x.pdf");

      expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("returns null when the object does not exist", async () => {
      download.mockResolvedValueOnce({
        data: null,
        error: { message: "not found" },
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      const bytes = await gateway.download("owner-1/x.pdf");

      expect(bytes).toBeNull();
    });

    it("propagates a thrown transient error (e.g. an aborted fetch)", async () => {
      download.mockRejectedValueOnce(new Error("network down"));
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      await expect(gateway.download("owner-1/x.pdf")).rejects.toThrow(
        "network down",
      );
    });

    it("forwards an AbortSignal to the underlying client call", async () => {
      const controller = new AbortController();
      download.mockResolvedValueOnce({
        data: new Blob([new Uint8Array([1])]),
        error: null,
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      await gateway.download("owner-1/x.pdf", { signal: controller.signal });

      expect(download).toHaveBeenCalledWith(
        "owner-1/x.pdf",
        expect.anything(),
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });
});
