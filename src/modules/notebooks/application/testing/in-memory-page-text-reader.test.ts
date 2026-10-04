import { describe, expect, it } from "vitest";
import { InMemoryPageTextReader } from "./in-memory-page-text-reader";

describe("InMemoryPageTextReader", () => {
  it("returns seeded text to its owner and NOT_FOUND to anyone else", async () => {
    const reader = new InMemoryPageTextReader();
    reader.seed("p1", "o1", { title: "T", plainText: "texto" });

    expect(await reader.getPageText("p1", "o1")).toEqual({
      ok: true,
      value: { title: "T", plainText: "texto" },
    });
    const other = await reader.getPageText("p1", "o2");
    expect(!other.ok && other.error.code).toBe("PAGE_NOT_FOUND");
    const missing = await reader.getPageText("nope", "o1");
    expect(!missing.ok && missing.error.code).toBe("PAGE_NOT_FOUND");
  });
});
