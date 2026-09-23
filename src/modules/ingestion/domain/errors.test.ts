import { describe, expect, it } from "vitest";
import { IMPORT_JOB_ERROR } from "./errors";

describe("ingestion domain error codes", () => {
  it("exposes the import job error code from design.md", () => {
    expect(IMPORT_JOB_ERROR).toEqual({
      INVALID_TRANSITION: "IMPORT_JOB_INVALID_TRANSITION",
    });
  });
});
