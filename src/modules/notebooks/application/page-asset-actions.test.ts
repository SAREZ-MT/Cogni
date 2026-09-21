import { describe, expect, it } from "vitest";
import { getAssetReadUrlSchema } from "./get-asset-read-url";
import { registerPageAssetSchema } from "./register-page-asset";
import { requestImageUploadSchema } from "./request-image-upload";

// specs/page-assets/spec.md, "Subida directa desde el navegador" (Scenario:
// "Server Actions solo con metadatos"): the upload/register Server Actions'
// Zod schemas MUST accept only identifiers, mime, sizeBytes and
// storagePath — never binary file data.
describe("page-asset Server Action schemas", () => {
  it("requestImageUploadSchema accepts only pageId/mime/sizeBytes", () => {
    const parsed = requestImageUploadSchema.safeParse({
      pageId: "page-1",
      mime: "image/png",
      sizeBytes: 1024,
      file: new Uint8Array([1, 2, 3]),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        pageId: "page-1",
        mime: "image/png",
        sizeBytes: 1024,
      });
      expect(parsed.data).not.toHaveProperty("file");
    }
  });

  it("requestImageUploadSchema rejects a binary sizeBytes/mime shape", () => {
    const parsed = requestImageUploadSchema.safeParse({
      pageId: "page-1",
      mime: new Uint8Array([1, 2, 3]),
      sizeBytes: "not-a-number",
    });
    expect(parsed.success).toBe(false);
  });

  it("registerPageAssetSchema accepts only pageId/storagePath/mime/sizeBytes", () => {
    const parsed = registerPageAssetSchema.safeParse({
      pageId: "page-1",
      storagePath: "owner/page-1/asset.png",
      mime: "image/png",
      sizeBytes: 1024,
      body: new Blob(),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        pageId: "page-1",
        storagePath: "owner/page-1/asset.png",
        mime: "image/png",
        sizeBytes: 1024,
      });
      expect(parsed.data).not.toHaveProperty("body");
    }
  });

  it("getAssetReadUrlSchema accepts only assetId", () => {
    const parsed = getAssetReadUrlSchema.safeParse({
      assetId: "asset-1",
      extra: "should be dropped",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ assetId: "asset-1" });
    }
  });
});
