import { describe, expect, it } from "vitest";
import type { PageProgressRow } from "./progress";
import {
  rankWeakTopics,
  WEAK_TOPIC_MAX_ACCURACY,
  WEAK_TOPIC_MIN_ATTEMPTS,
  WEAK_TOPICS_LIMIT,
} from "./weak-topics";

const page = (pageId: string, notebookId = "nb-1"): PageProgressRow => ({
  pageId,
  pageTitle: `Página ${pageId}`,
  notebookId,
  notebookTitle: `Cuaderno ${notebookId}`,
  notebookColor: "green",
  level: null,
  score: null,
  itemsTotal: 0,
  itemsDue: 0,
});

const exam = (pageId: string, isCorrect: boolean) => ({ pageId, isCorrect });
const recall = (pageId: string, aiScore: number) => ({ pageId, aiScore });

describe("rankWeakTopics", () => {
  it("uses the dashboard rules: 3+ attempts, under 70%, 5 at most", () => {
    expect(WEAK_TOPIC_MIN_ATTEMPTS).toBe(3);
    expect(WEAK_TOPIC_MAX_ACCURACY).toBe(0.7);
    expect(WEAK_TOPICS_LIMIT).toBe(5);
  });

  it("joins exam and recall outcomes per page with the dashboard's correctness rules", () => {
    const topics = rankWeakTopics({
      pages: [page("p-1")],
      examAnswers: [exam("p-1", true), exam("p-1", false)],
      // AI score 3 counts as correct, 2 does not.
      recallAnswers: [recall("p-1", 3), recall("p-1", 2)],
    });

    expect(topics).toEqual([
      {
        pageId: "p-1",
        pageTitle: "Página p-1",
        notebookId: "nb-1",
        notebookTitle: "Cuaderno nb-1",
        notebookColor: "green",
        accuracy: 0.5,
        attempts: 4,
      },
    ]);
  });

  it("ignores pages with fewer attempts than the minimum", () => {
    const topics = rankWeakTopics({
      pages: [page("p-1")],
      examAnswers: [exam("p-1", false), exam("p-1", false)],
      recallAnswers: [],
    });

    expect(topics).toEqual([]);
  });

  it("ignores pages at or above the accuracy threshold", () => {
    const topics = rankWeakTopics({
      pages: [page("p-1"), page("p-2")],
      // 7 of 10 = 70%: not weak.
      examAnswers: [
        ...Array.from({ length: 7 }, () => exam("p-1", true)),
        ...Array.from({ length: 3 }, () => exam("p-1", false)),
        exam("p-2", true),
        exam("p-2", false),
        exam("p-2", false),
      ],
      recallAnswers: [],
    });

    expect(topics.map((topic) => topic.pageId)).toEqual(["p-2"]);
  });

  it("skips answers of pages that are no longer live", () => {
    const topics = rankWeakTopics({
      pages: [],
      examAnswers: [exam("gone", false), exam("gone", false)],
      recallAnswers: [recall("gone", 0)],
    });

    expect(topics).toEqual([]);
  });

  it("orders worst first, then more attempts, then page id, and keeps 5", () => {
    const wrong = (pageId: string, count: number) =>
      Array.from({ length: count }, () => exam(pageId, false));
    const topics = rankWeakTopics({
      pages: ["a", "b", "c", "d", "e", "f", "g"].map((id) => page(id)),
      examAnswers: [
        // 1/3 right.
        exam("a", true),
        ...wrong("a", 2),
        // 0/4 right.
        ...wrong("b", 4),
        // 0/3 right: same accuracy as b, fewer attempts.
        ...wrong("c", 3),
        // 0/3 right: ties with c, page id breaks it.
        ...wrong("d", 3),
        // 2/4 right.
        exam("e", true),
        exam("e", true),
        ...wrong("e", 2),
        // 1/4 right.
        exam("f", true),
        ...wrong("f", 3),
        // 2/3 right.
        exam("g", true),
        exam("g", true),
        exam("g", false),
      ],
      recallAnswers: [],
    });

    expect(topics.map((topic) => topic.pageId)).toEqual([
      "b",
      "c",
      "d",
      "f",
      "a",
    ]);
  });
});
