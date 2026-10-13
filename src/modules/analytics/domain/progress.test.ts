import { describe, expect, it } from "vitest";
import { buildProgress, type PageProgressRow } from "./progress";
import type { ReviewFact } from "./review-activity";

const row = (overrides: Partial<PageProgressRow> = {}): PageProgressRow => ({
  pageId: "p-1",
  pageTitle: "Mitocondria",
  notebookId: "nb-1",
  notebookTitle: "Biología",
  notebookColor: "green",
  level: "Consolidando",
  score: 0.5,
  itemsTotal: 10,
  itemsDue: 2,
  ...overrides,
});

const review = (overrides: Partial<ReviewFact> = {}): ReviewFact => ({
  pageId: "p-1",
  notebookId: "nb-1",
  technique: "flashcards",
  quality: 4,
  reviewedAt: new Date("2026-10-13T12:00:00.000Z"),
  ...overrides,
});

const weekStarts = ["2026-10-05", "2026-10-12"];
const options = { weekStarts, timeZone: "UTC" };

describe("buildProgress", () => {
  it("keeps each page's mastery and items and adds its weekly quality trend", () => {
    const progress = buildProgress(
      [row()],
      [review({ quality: 2, reviewedAt: new Date("2026-10-06T12:00:00Z") })],
      options,
    );

    expect(progress.weekStarts).toEqual(weekStarts);
    expect(progress.pages).toEqual([
      {
        pageId: "p-1",
        pageTitle: "Mitocondria",
        notebookId: "nb-1",
        level: "Consolidando",
        score: 0.5,
        itemsTotal: 10,
        itemsDue: 2,
        trend: [
          { weekStart: "2026-10-05", reviews: 1, averageQuality: 2 },
          { weekStart: "2026-10-12", reviews: 0, averageQuality: null },
        ],
      },
    ]);
  });

  it("reads a page with no mastery row as new with score 0", () => {
    const progress = buildProgress(
      [row({ level: null, score: null, itemsTotal: 0, itemsDue: 0 })],
      [],
      options,
    );

    expect(progress.pages[0]).toMatchObject({ level: "Nuevo", score: 0 });
  });

  it("rolls pages up per notebook in reader order", () => {
    const progress = buildProgress(
      [
        row({
          notebookId: "nb-2",
          notebookTitle: "Cálculo",
          notebookColor: null,
          pageId: "p-9",
          score: 0.9,
          itemsTotal: 4,
          itemsDue: 1,
        }),
        row({ pageId: "p-1", score: 0.25, itemsTotal: 10, itemsDue: 2 }),
        row({ pageId: "p-2", score: 0.75, itemsTotal: 6, itemsDue: 3 }),
        // A page without items has no mastery to average.
        row({
          pageId: "p-3",
          level: null,
          score: null,
          itemsTotal: 0,
          itemsDue: 0,
        }),
      ],
      [
        review({ pageId: "p-1", quality: 3 }),
        review({ pageId: "p-2", quality: 5 }),
        review({ pageId: "p-2", quality: 4 }),
      ],
      options,
    );

    expect(progress.notebooks).toEqual([
      {
        notebookId: "nb-2",
        title: "Cálculo",
        color: null,
        pages: 1,
        itemsTotal: 4,
        itemsDue: 1,
        averageScore: 0.9,
        trend: [
          { weekStart: "2026-10-05", reviews: 0, averageQuality: null },
          { weekStart: "2026-10-12", reviews: 0, averageQuality: null },
        ],
      },
      {
        notebookId: "nb-1",
        title: "Biología",
        color: "green",
        pages: 3,
        itemsTotal: 16,
        itemsDue: 5,
        averageScore: 0.5,
        trend: [
          { weekStart: "2026-10-05", reviews: 0, averageQuality: null },
          { weekStart: "2026-10-12", reviews: 3, averageQuality: 4 },
        ],
      },
    ]);
  });

  it("has no notebook average while no page has items", () => {
    const progress = buildProgress(
      [row({ level: null, score: null, itemsTotal: 0, itemsDue: 0 })],
      [],
      options,
    );

    expect(progress.notebooks[0]?.averageScore).toBeNull();
  });
});
