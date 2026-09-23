import { describe, expect, it } from "vitest";
import { FakePdfStorageGateway } from "./fake-pdf-storage-gateway";

describe("FakePdfStorageGateway", () => {
  it("issues a signed upload URL containing the path and records the call", async () => {
    const gateway = new FakePdfStorageGateway();

    const grant = await gateway.createSignedUploadUrl("owner-1/upload-id.pdf");

    expect(grant.signedUrl).toContain("owner-1/upload-id.pdf");
    expect(grant.token).toBeTruthy();
    expect(grant.bucket).toBe("page-pdfs");
    expect(gateway.signedUploadUrlCalls).toEqual(["owner-1/upload-id.pdf"]);
  });

  it("returns null metadata for an object that was never put()", async () => {
    const gateway = new FakePdfStorageGateway();

    const metadata = await gateway.getObjectMetadata("missing.pdf");

    expect(metadata).toBeNull();
    expect(gateway.getObjectMetadataCalls).toEqual(["missing.pdf"]);
  });

  it("returns the metadata of an object seeded with put()", async () => {
    const gateway = new FakePdfStorageGateway();
    gateway.put("owner-1/upload-id.pdf", {
      sizeBytes: 1024,
      mime: "application/pdf",
    });

    const metadata = await gateway.getObjectMetadata("owner-1/upload-id.pdf");

    expect(metadata).toEqual({ sizeBytes: 1024, mime: "application/pdf" });
  });

  it("downloads the bytes of a seeded object and records the call", async () => {
    const gateway = new FakePdfStorageGateway();
    const bytes = new Uint8Array([1, 2, 3]);
    gateway.put("owner-1/upload-id.pdf", {
      sizeBytes: 3,
      mime: "application/pdf",
      bytes,
    });

    const downloaded = await gateway.download("owner-1/upload-id.pdf");

    expect(downloaded).toBe(bytes);
    expect(gateway.downloadCalls).toEqual(["owner-1/upload-id.pdf"]);
  });

  it("returns null when downloading an object that was never put()", async () => {
    const gateway = new FakePdfStorageGateway();

    const downloaded = await gateway.download("missing.pdf");

    expect(downloaded).toBeNull();
  });

  // T8: requestPdfUpload/startPdfImport must map a thrown storage call to a
  // typed failure (INGESTION_ERROR.STORAGE_UNAVAILABLE); these let their
  // tests force that throw without a real Supabase client.
  describe("forced errors", () => {
    it("throws the forced error once from createSignedUploadUrl, then recovers", async () => {
      const gateway = new FakePdfStorageGateway();
      const forced = new Error("transient storage failure");
      gateway.forceNextCreateSignedUploadUrlError(forced);

      await expect(gateway.createSignedUploadUrl("owner-1/x.pdf")).rejects.toBe(
        forced,
      );
      await expect(
        gateway.createSignedUploadUrl("owner-1/x.pdf"),
      ).resolves.toBeTruthy();
    });

    it("throws the forced error once from getObjectMetadata, then recovers", async () => {
      const gateway = new FakePdfStorageGateway();
      gateway.put("owner-1/x.pdf", { sizeBytes: 10, mime: "application/pdf" });
      const forced = new Error("transient storage failure");
      gateway.forceNextGetObjectMetadataError(forced);

      await expect(gateway.getObjectMetadata("owner-1/x.pdf")).rejects.toBe(
        forced,
      );
      await expect(gateway.getObjectMetadata("owner-1/x.pdf")).resolves.toEqual(
        { sizeBytes: 10, mime: "application/pdf" },
      );
    });
  });
});
