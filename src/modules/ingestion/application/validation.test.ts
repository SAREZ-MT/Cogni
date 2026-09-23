import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseInput } from "./validation";

const schema = z.object({ notebookId: z.string() });

describe("parseInput", () => {
  it("returns the parsed value for valid input", () => {
    const result = parseInput(schema, { notebookId: "nb-1" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ notebookId: "nb-1" });
  });

  it("names the offending field in the error when the issue has a path", () => {
    const result = parseInput(schema, {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INGESTION_INVALID_INPUT");
      expect(result.error.message).toBe("invalid notebookId");
    }
  });

  it("falls back to a generic field name when the issue has no path (root-level failure)", () => {
    const result = parseInput(schema, null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INGESTION_INVALID_INPUT");
      expect(result.error.message).toBe("invalid input");
    }
  });
});
