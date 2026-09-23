import { describe, expect, it } from "vitest";
import { IMPORT_JOB_ERROR, INGESTION_ERROR, PDF_FILE_ERROR } from "./errors";

describe("ingestion domain error codes", () => {
  it("exposes the import job error codes from design.md", () => {
    expect(IMPORT_JOB_ERROR).toEqual({
      INVALID_TRANSITION: "IMPORT_JOB_INVALID_TRANSITION",
      NOT_FOUND: "IMPORT_JOB_NOT_FOUND",
      STORAGE_PATH_CONFLICT: "IMPORT_JOB_STORAGE_PATH_CONFLICT",
    });
  });

  it("exposes the pdf-file error codes from design.md", () => {
    expect(PDF_FILE_ERROR).toEqual({
      MIME_NOT_ALLOWED: "PDF_MIME_NOT_ALLOWED",
      TOO_LARGE: "PDF_TOO_LARGE",
      FILE_NAME_INVALID: "PDF_FILE_NAME_INVALID",
      PATH_OUT_OF_SCOPE: "PDF_PATH_OUT_OF_SCOPE",
      UPLOAD_EXPIRED: "PDF_UPLOAD_EXPIRED",
      OBJECT_MISSING: "PDF_OBJECT_MISSING",
      UNREADABLE: "PDF_UNREADABLE",
    });
  });

  it("exposes the ingestion-level error codes (T5/T6/T7b/T8 additions)", () => {
    expect(INGESTION_ERROR).toEqual({
      NOTEBOOK_NOT_FOUND: "INGESTION_NOTEBOOK_NOT_FOUND",
      NOTEBOOK_MISMATCH: "INGESTION_NOTEBOOK_MISMATCH",
      PAGE_NOT_FOUND: "INGESTION_PAGE_NOT_FOUND",
      SESSION_REQUIRED: "INGESTION_SESSION_REQUIRED",
      STORAGE_UNAVAILABLE: "INGESTION_STORAGE_UNAVAILABLE",
    });
  });
});
