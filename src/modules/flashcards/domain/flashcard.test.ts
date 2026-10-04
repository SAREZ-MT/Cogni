import { describe, expect, it } from "vitest";
import { FLASHCARD_ERROR } from "./errors";
import { createFlashcard } from "./flashcard";

const base = {
  id: "card-1",
  ownerId: "owner-1",
  pageId: "page-1",
  generationId: null,
  origin: "manual" as const,
  position: 0,
};
const now = new Date("2026-10-03T10:00:00.000Z");

describe("createFlashcard", () => {
  it("trims front and back and stamps both timestamps", () => {
    const result = createFlashcard(
      { ...base, front: "  ¿Qué es X?  ", back: "\n Y \t" },
      now,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.front).toBe("¿Qué es X?");
    expect(result.value.back).toBe("Y");
    expect(result.value.createdAt).toEqual(now);
    expect(result.value.updatedAt).toEqual(now);
  });

  it("rejects a blank front", () => {
    const result = createFlashcard({ ...base, front: "   ", back: "Y" }, now);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(FLASHCARD_ERROR.EMPTY);
  });

  it("rejects a blank back", () => {
    const result = createFlashcard({ ...base, front: "X", back: "" }, now);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(FLASHCARD_ERROR.EMPTY);
  });
});
