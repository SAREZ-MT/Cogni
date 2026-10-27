import { describe, expect, it } from "vitest";
import { ASSET_ERROR, NOTEBOOK_ERROR, PAGE_ERROR } from "./errors";

describe("notebooks domain error codes", () => {
  it("exposes the notebook error codes from design.md", () => {
    expect(NOTEBOOK_ERROR).toEqual({
      NOT_FOUND: "NOTEBOOK_NOT_FOUND",
      ARCHIVED: "NOTEBOOK_ARCHIVED",
      INVALID_TITLE: "NOTEBOOK_INVALID_TITLE",
      INVALID_COLOR: "NOTEBOOK_INVALID_COLOR",
    });
  });

  it("exposes the page error codes from design.md", () => {
    expect(PAGE_ERROR).toEqual({
      NOT_FOUND: "PAGE_NOT_FOUND",
      VERSION_CONFLICT: "PAGE_VERSION_CONFLICT",
      INVALID_CONTENT: "PAGE_INVALID_CONTENT",
    });
  });

  it("exposes the asset error codes from design.md", () => {
    expect(ASSET_ERROR).toEqual({
      MIME_NOT_ALLOWED: "ASSET_MIME_NOT_ALLOWED",
      TOO_LARGE: "ASSET_TOO_LARGE",
      PATH_OUT_OF_SCOPE: "ASSET_PATH_OUT_OF_SCOPE",
      FORBIDDEN: "ASSET_FORBIDDEN",
      UPLOAD_FAILED: "ASSET_UPLOAD_FAILED",
    });
  });
});
