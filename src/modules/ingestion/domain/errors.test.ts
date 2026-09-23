import { describe, expect, it } from "vitest";
import { IMPORT_JOB_ERROR, PDF_FILE_ERROR } from "./errors";

describe("ingestion domain error codes", () => {
  it("exposes the import job error code from design.md", () => {
    expect(IMPORT_JOB_ERROR).toEqual({
      INVALID_TRANSITION: "IMPORT_JOB_INVALID_TRANSITION",
    });
  });

  it("exposes the pdf-file error codes from design.md", () => {
    expect(PDF_FILE_ERROR).toEqual({
      MIME_NOT_ALLOWED: "PDF_MIME_NOT_ALLOWED",
      TOO_LARGE: "PDF_TOO_LARGE",
      FILE_NAME_INVALID: "PDF_FILE_NAME_INVALID",
    });
  });
});
