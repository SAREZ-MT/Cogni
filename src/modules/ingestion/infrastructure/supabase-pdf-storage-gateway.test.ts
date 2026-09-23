import { StorageApiError } from "@supabase/supabase-js";
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

// `StorageApiError` is kept as the real class (via importOriginal) instead
// of also being stubbed: the adapter's not-found detection does an
// `instanceof StorageApiError` check, so the test must construct the very
// same class the adapter imports from this mocked module.
vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  return {
    ...actual,
    createClient: (...args: unknown[]) => createClient(...args),
  };
});

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

    // T7b review follow-up (R3-signed-url-sanitization-test-vacuous): the
    // previous version only mocked the first call — the second, unmocked
    // call returned `undefined` from the `vi.fn()` default, so destructuring
    // `{ data, error }` inside the adapter threw its own TypeError, and the
    // catch block's assertions passed against that TypeError instead of
    // against the sanitization path they claimed to prove. `expect.
    // assertions` plus a second, distinctly-mocked failure make sure both
    // calls actually exercise `createSignedUploadUrl`'s error branch.
    it("throws a typed PdfStorageAdapterError, never the raw Supabase error", async () => {
      expect.assertions(4);
      const firstRawError = {
        message: "internal supabase detail",
        status: 500,
      };
      createSignedUploadUrl.mockResolvedValueOnce({
        data: null,
        error: firstRawError,
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      await expect(
        gateway.createSignedUploadUrl("owner-1/x.pdf"),
      ).rejects.toBeInstanceOf(PdfStorageAdapterError);

      const secondRawError = {
        message: "another internal supabase detail",
        status: 503,
      };
      createSignedUploadUrl.mockResolvedValueOnce({
        data: null,
        error: secondRawError,
      });
      try {
        await gateway.createSignedUploadUrl("owner-1/x.pdf");
        throw new Error("expected createSignedUploadUrl to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(PdfStorageAdapterError);
        expect(error).not.toBe(secondRawError);
        expect((error as Error).message).not.toContain("supabase detail");
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

    // T7b review follow-up (R3-metadata-transient-error-as-missing): the
    // real client resolves a `StorageApiError` (never rejects) for a
    // not-found object, carrying `status`/`statusCode` "404".
    it("returns null (never throws) when the object does not exist (structured StorageApiError)", async () => {
      info.mockResolvedValueOnce({
        data: null,
        error: new StorageApiError("Object not found", 404, "404"),
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      const metadata = await gateway.getObjectMetadata("owner-1/x.pdf");

      expect(metadata).toBeNull();
    });

    // Defensive fallback branch: an error that carries the "Object not
    // found" message but not the structured status/statusCode (e.g. a
    // future client version, or a differently-shaped test double).
    it("returns null when a plain error object's message says the object was not found", async () => {
      info.mockResolvedValueOnce({
        data: null,
        error: { message: "Object not found" },
      });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      const metadata = await gateway.getObjectMetadata("owner-1/x.pdf");

      expect(metadata).toBeNull();
    });

    // T7b review follow-up (R3-metadata-transient-error-as-missing): a
    // transient/5xx failure must never be reported as "object does not
    // exist" — the caller (startPdfImport) would otherwise tell the user
    // their upload vanished instead of retrying.
    // T7c review follow-up (R3-metadata-error-sanitization-unasserted): the
    // raw Supabase error must survive as `cause` (server-side diagnostics
    // only — actions.ts, T8, never forwards it to the client), and the
    // thrown error's own message must never repeat the raw error's detail.
    it("throws a typed PdfStorageAdapterError for a transient/5xx error, never treating it as missing", async () => {
      expect.assertions(4);
      const rawError = new StorageApiError("internal server error", 500, "500");
      info.mockResolvedValueOnce({ data: null, error: rawError });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      try {
        await gateway.getObjectMetadata("owner-1/x.pdf");
        throw new Error("expected getObjectMetadata to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(PdfStorageAdapterError);
        expect((error as PdfStorageAdapterError).cause).toBe(rawError);
        expect((error as Error).message).not.toContain("internal server error");
        expect((error as Error).message).not.toBe(rawError.message);
      }
    });

    it("throws a typed PdfStorageAdapterError for an error with no recognizable not-found shape", async () => {
      expect.assertions(4);
      const rawError = { weird: "shape", message: "internal supabase detail" };
      info.mockResolvedValueOnce({ data: null, error: rawError });
      const gateway = new SupabasePdfStorageGateway(CONFIG);

      try {
        await gateway.getObjectMetadata("owner-1/x.pdf");
        throw new Error("expected getObjectMetadata to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(PdfStorageAdapterError);
        expect((error as PdfStorageAdapterError).cause).toBe(rawError);
        expect((error as Error).message).not.toContain(
          "internal supabase detail",
        );
        expect((error as Error).message).not.toBe(rawError.message);
      }
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
