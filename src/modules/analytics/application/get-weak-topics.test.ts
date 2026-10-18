import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { getWeakTopics, WEAK_TOPICS_WINDOW_DAYS } from "./get-weak-topics";
import { seededStore } from "./testing/seeded-store";

const NOW = new Date("2026-10-18T12:00:00.000Z");
const at = (iso: string) => new Date(iso);

describe("getWeakTopics", () => {
  it("looks back 30 days", () => {
    expect(WEAK_TOPICS_WINDOW_DAYS).toBe(30);
  });

  it("ranks the owner's live pages by recall and exam accuracy over the last 30 days", async () => {
    const store = seededStore();
    // p-1: 1 of 3 right inside the window.
    store.addExamAnswer({
      pageId: "p-1",
      isCorrect: true,
      answeredAt: at("2026-10-17T10:00:00Z"),
      finished: true,
    });
    store.addRecallAnswer({
      pageId: "p-1",
      selfRating: 3,
      aiScore: 1,
      status: "done",
      answeredAt: at("2026-10-10T10:00:00Z"),
    });
    store.addRecallAnswer({
      pageId: "p-1",
      selfRating: 3,
      aiScore: 2,
      status: "done",
      answeredAt: at("2026-09-19T12:00:00Z"),
    });
    // Older than 30 days: ignored, so p-1 is not 1 of 4.
    store.addExamAnswer({
      pageId: "p-1",
      isCorrect: false,
      answeredAt: at("2026-09-18T11:59:59Z"),
      finished: true,
    });
    // p-2: an unfinished exam does not count, so it stays under 3 attempts.
    for (const iso of ["2026-10-15T10:00:00Z", "2026-10-15T10:01:00Z"]) {
      store.addExamAnswer({
        pageId: "p-2",
        isCorrect: false,
        answeredAt: at(iso),
        finished: true,
      });
    }
    store.addExamAnswer({
      pageId: "p-2",
      isCorrect: false,
      answeredAt: at("2026-10-15T10:02:00Z"),
      finished: false,
    });

    const topics = await getWeakTopics(
      { ownerId: "owner-1" },
      { answers: store, pages: store, clock: createFixedClock(NOW) },
    );

    expect(topics).toEqual([
      {
        pageId: "p-1",
        pageTitle: "Mitocondria",
        notebookId: "nb-1",
        notebookTitle: "Biología",
        notebookColor: "green",
        accuracy: 1 / 3,
        attempts: 3,
      },
    ]);
  });

  it("returns nothing for another owner", async () => {
    const store = seededStore();
    for (const iso of [
      "2026-10-15T10:00:00Z",
      "2026-10-15T10:01:00Z",
      "2026-10-15T10:02:00Z",
    ]) {
      store.addExamAnswer({
        pageId: "p-1",
        isCorrect: false,
        answeredAt: at(iso),
        finished: true,
      });
    }

    const topics = await getWeakTopics(
      { ownerId: "owner-2" },
      { answers: store, pages: store, clock: createFixedClock(NOW) },
    );

    expect(topics).toEqual([]);
  });
});
