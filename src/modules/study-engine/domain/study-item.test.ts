import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import {
  FLASHCARD_QUALITY,
  INITIAL_EASINESS,
  MIN_EASINESS,
  newStudyItem,
  recallReviewQualityFor,
} from "./study-item";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

describe("newStudyItem", () => {
  it("creates an item that is due immediately with the initial SM-2 state", () => {
    const item = newStudyItem({
      id: "item-1",
      ownerId: OWNER_ID,
      pageId: "page-1",
      kind: "flashcard",
      sourceId: "card-1",
      now: createFixedClock(NOW).now(),
    });

    expect(item.id).toBe("item-1");
    expect(item.ownerId).toBe(OWNER_ID);
    expect(item.pageId).toBe("page-1");
    expect(item.kind).toBe("flashcard");
    expect(item.sourceId).toBe("card-1");
    expect(item.easiness).toBe(INITIAL_EASINESS);
    expect(item.intervalDays).toBe(0);
    expect(item.repetitions).toBe(0);
    expect(item.lapses).toBe(0);
    expect(item.lastQuality).toBeNull();
    expect(item.lastReviewedAt).toBeNull();
    expect(item.dueAt).toEqual(NOW);
    expect(item.suspendedAt).toBeNull();
    expect(item.createdAt).toEqual(NOW);
    expect(item.updatedAt).toEqual(NOW);
  });

  it("accepts every item kind", () => {
    for (const kind of [
      "flashcard",
      "exam_question",
      "recall_question",
    ] as const) {
      const item = newStudyItem({
        id: "i",
        ownerId: OWNER_ID,
        pageId: "p",
        kind,
        sourceId: "s",
        now: NOW,
      });
      expect(item.kind).toBe(kind);
    }
  });
});

describe("constants", () => {
  it("exposes the SM-2 easiness bounds from §6.1", () => {
    expect(INITIAL_EASINESS).toBe(2.5);
    expect(MIN_EASINESS).toBe(1.3);
  });

  it("maps the four flashcard buttons to §7.2 qualities", () => {
    expect(FLASHCARD_QUALITY).toEqual({ again: 1, hard: 3, good: 4, easy: 5 });
  });
});

// Recall answers carry their own 0–5 combined quality (§7.4). A failing
// quality (< 3) always reviews, due or not; a passing one reviews only a
// due item, so a recall answer evaluated after the item was already
// reviewed never inflates its interval (same rule as exams).
describe("recallReviewQualityFor", () => {
  it("keeps a failing quality whether or not the item was due", () => {
    for (const quality of [0, 1, 2] as const) {
      expect(recallReviewQualityFor({ quality, wasDue: true })).toBe(quality);
      expect(recallReviewQualityFor({ quality, wasDue: false })).toBe(quality);
    }
  });

  it("keeps a passing quality only when the item was due", () => {
    for (const quality of [3, 4, 5] as const) {
      expect(recallReviewQualityFor({ quality, wasDue: true })).toBe(quality);
      expect(recallReviewQualityFor({ quality, wasDue: false })).toBeNull();
    }
  });
});
