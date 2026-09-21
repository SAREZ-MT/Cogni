import { describe, expect, it } from "vitest";
import { ASSET_ERROR } from "./errors";
import {
  ALLOWED_MIME,
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
