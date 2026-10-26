import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FILE_ERROR,
  IMPORT_JOB_ERROR,
  INGESTION_ERROR,
} from "./errors";

describe("ingestion domain error codes", () => {
  it("exposes the import job error codes from design.md", () => {
    expect(IMPORT_JOB_ERROR).toEqual({
      INVALID_TRANSITION: "IMPORT_JOB_INVALID_TRANSITION",
      NOT_FOUND: "IMPORT_JOB_NOT_FOUND",
      STORAGE_PATH_CONFLICT: "IMPORT_JOB_STORAGE_PATH_CONFLICT",
    });
  });

  it("exposes the document-file error codes (PDF_* renamed to DOCUMENT_* in document-import T5)", () => {
    expect(DOCUMENT_FILE_ERROR).toEqual({
      MIME_NOT_ALLOWED: "DOCUMENT_MIME_NOT_ALLOWED",
      TOO_LARGE: "DOCUMENT_TOO_LARGE",
      FILE_NAME_INVALID: "DOCUMENT_FILE_NAME_INVALID",
      PATH_OUT_OF_SCOPE: "DOCUMENT_PATH_OUT_OF_SCOPE",
      UPLOAD_EXPIRED: "DOCUMENT_UPLOAD_EXPIRED",
      OBJECT_MISSING: "DOCUMENT_OBJECT_MISSING",
      UNREADABLE: "DOCUMENT_UNREADABLE",
      UNSUPPORTED_FORMAT: "DOCUMENT_UNSUPPORTED_FORMAT",
    });
  });

  it("exposes the ingestion-level error codes (T5/T6/T7b/T8/T10 additions)", () => {
    expect(INGESTION_ERROR).toEqual({
      NOTEBOOK_NOT_FOUND: "INGESTION_NOTEBOOK_NOT_FOUND",
      NOTEBOOK_MISMATCH: "INGESTION_NOTEBOOK_MISMATCH",
      PAGE_NOT_FOUND: "INGESTION_PAGE_NOT_FOUND",
      SESSION_REQUIRED: "INGESTION_SESSION_REQUIRED",
      STORAGE_UNAVAILABLE: "INGESTION_STORAGE_UNAVAILABLE",
      UNEXPECTED: "INGESTION_UNEXPECTED",
    });
  });
});
