import { describe, expect, it } from "vitest";
import { ASSET_ERROR } from "./errors";
import {
  ALLOWED_MIME,
  isCanonicalStoragePath,
  MAX_ASSET_BYTES,
  validateAssetInput,
} from "./page-asset";

// specs/page-assets/spec.md, "Permiso de subida firmado con límites del
// servidor": Scenarios "MIME no permitido" and "Tamaño excedido".
describe("validateAssetInput", () => {
  it("accepts a valid image/png input within the size limit", () => {
    const result = validateAssetInput({
      mime: "image/png",
      sizeBytes: 2 * 1024 * 1024,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts every allowed mime type", () => {
    for (const mime of ALLOWED_MIME) {
      const result = validateAssetInput({ mime, sizeBytes: 1024 });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects a mime type outside the allow-list (Scenario: MIME no permitido)", () => {
    const result = validateAssetInput({
      mime: "image/svg+xml",
      sizeBytes: 1024,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe(ASSET_ERROR.MIME_NOT_ALLOWED);
  });

  it("rejects a size over the 10 MB limit (Scenario: Tamaño excedido)", () => {
    const result = validateAssetInput({
      mime: "image/png",
      sizeBytes: MAX_ASSET_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ASSET_ERROR.TOO_LARGE);
  });

  it("accepts a size exactly at the limit", () => {
    const result = validateAssetInput({
      mime: "image/png",
      sizeBytes: MAX_ASSET_BYTES,
    });
    expect(result.ok).toBe(true);
  });
});

// specs/page-assets/spec.md, "Registro de PageAsset con revalidación": the
// storagePath must be exactly `{ownerId}/{pageId}/{assetId}.{ext}`. A bare
// prefix check would let a path that starts with the caller's own prefix
// but continues with dot-segments resolve to another owner's object.
describe("isCanonicalStoragePath", () => {
  const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
  const PAGE = "7c1a2b3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";

  it("accepts the shape RequestImageUpload generates", () => {
    expect(
      isCanonicalStoragePath(OWNER, PAGE, `${OWNER}/${PAGE}/abc_DEF-123.png`),
    ).toBe(true);
  });

  it.each([
    ["literal parent segments", `${OWNER}/${PAGE}/../../other/x.png`],
    ["percent-encoded parent segments", `${OWNER}/${PAGE}/%2e%2e/x.png`],
    ["a single dot segment", `${OWNER}/${PAGE}/./x.png`],
    ["an extra nested segment", `${OWNER}/${PAGE}/sub/x.png`],
    ["a missing extension", `${OWNER}/${PAGE}/x`],
    ["a different owner", `other/${PAGE}/x.png`],
    ["a different page", `${OWNER}/other/x.png`],
    ["a trailing slash", `${OWNER}/${PAGE}/x.png/`],
    ["an empty file name", `${OWNER}/${PAGE}/.png`],
  ])("rejects %s", (_label, path) => {
    expect(isCanonicalStoragePath(OWNER, PAGE, path)).toBe(false);
  });
});
