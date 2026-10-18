import { describe, expect, it } from "vitest";
import type { DueKind } from "../../domain/due-today";
import type {
  TechniqueOverviewReader,
  TechniqueSnapshotBounds,
} from "../../domain/technique-overview-reader";
import type {
  DuePageFixture,
  DueTodayReaderContractContext,
} from "./due-today-reader.contract";

export interface TechniqueOverviewReaderContractContext
  extends DueTodayReaderContractContext {
  // Adds one live item (owned by the page's owner) due at `dueAt` and one
  // review log of it at `reviewedAt`, with the technique's session kind.
  readonly addReviewedItem: (
    page: DuePageFixture,
    input: { kind?: DueKind; dueAt: Date; reviewedAt: Date },
  ) => Promise<void>;
}

export interface TechniqueOverviewReaderContractOptions {
  createReader(): TechniqueOverviewReader;
  // Same fixtures as the DueTodayReader contract, plus reviewed items. The
  // overview is not scoped to pages, so the DB runner must give each test
  // a fresh owner pair (the counts cover every item the owner has).
  context: () => TechniqueOverviewReaderContractContext;
}

// Sunday 18 Oct 2026 in Bogotá (-05): [REVIEWED_FROM, UPCOMING_FROM).
const REVIEWED_FROM = new Date("2026-10-18T05:00:00.000Z");
const UPCOMING_FROM = new Date("2026-10-19T05:00:00.000Z");
const BOUNDS: TechniqueSnapshotBounds = {
  reviewedFrom: REVIEWED_FROM,
  dueBefore: UPCOMING_FROM,
};
const HOUR_MS = 3_600_000;
const hoursFrom = (hours: number) =>
  new Date(UPCOMING_FROM.getTime() + hours * HOUR_MS);
const NOTHING = {
  total: 0,
  nextDueAt: null,
  duePageIds: [],
  reviewedPageIds: [],
};

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runTechniqueOverviewReaderContract(
  options: TechniqueOverviewReaderContractOptions,
): void {
  describe("TechniqueOverviewReader contract", () => {
    it("counts every live item per technique, due or not", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      await ctx.addItem(page, { dueAt: hoursFrom(-72) });
      await ctx.addItem(page, { dueAt: hoursFrom(-1) });
      await ctx.addItem(page, { dueAt: hoursFrom(30) });
      await ctx.addItem(page, { kind: "exam_question", dueAt: hoursFrom(5) });

      const overview = await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS);

      expect(overview).toEqual({
        flashcard: {
          total: 3,
          nextDueAt: hoursFrom(30),
          duePageIds: [page.pageId],
          reviewedPageIds: [],
        },
        exam_question: {
          total: 1,
          nextDueAt: hoursFrom(5),
          duePageIds: [],
          reviewedPageIds: [],
        },
        recall_question: NOTHING,
      });
    });

    it("takes the next due date at or after the bound, never before it", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      await ctx.addItem(page, {
        kind: "recall_question",
        dueAt: new Date(UPCOMING_FROM.getTime() - 1),
      });
      await ctx.addItem(page, {
        kind: "recall_question",
        dueAt: hoursFrom(48),
      });
      await ctx.addItem(page, {
        kind: "recall_question",
        dueAt: UPCOMING_FROM,
      });
      await ctx.addItem(page, { dueAt: hoursFrom(-2) });

      const overview = await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS);

      expect(overview.recall_question).toEqual({
        total: 3,
        nextDueAt: UPCOMING_FROM,
        duePageIds: [page.pageId],
        reviewedPageIds: [],
      });
      // Only overdue items: counted, but nothing upcoming.
      expect(overview.flashcard).toMatchObject({ total: 1, nextDueAt: null });
    });

    it("leaves out suspended items, archived pages and archived notebooks", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const active = await ctx.newPage();
      const archivedPage = await ctx.newPage();
      const archivedNotebook = await ctx.newPage();
      await ctx.addItem(active, { dueAt: hoursFrom(10) });
      await ctx.addItem(active, { dueAt: hoursFrom(2), suspended: true });
      await ctx.addItem(archivedPage, { dueAt: hoursFrom(1) });
      await ctx.addItem(archivedNotebook, { dueAt: hoursFrom(1) });
      await ctx.archivePage(archivedPage);
      await ctx.archiveNotebook(archivedNotebook);

      const overview = await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS);

      expect(overview.flashcard).toEqual({
        total: 1,
        nextDueAt: hoursFrom(10),
        duePageIds: [],
        reviewedPageIds: [],
      });
    });

    it("never counts another owner's items", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const mine: DuePageFixture = await ctx.newPage();
      const theirs = await ctx.newPage(ctx.otherOwnerId);
      await ctx.addItem(mine, { dueAt: hoursFrom(3) });
      await ctx.addItem(theirs, { dueAt: hoursFrom(1) });
      await ctx.addItem(theirs, { dueAt: hoursFrom(2) });

      expect(
        (await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS)).flashcard,
      ).toMatchObject({ total: 1, nextDueAt: hoursFrom(3) });
      expect(
        (await reader.readTechniqueSnapshot(ctx.otherOwnerId, BOUNDS))
          .flashcard,
      ).toMatchObject({ total: 2, nextDueAt: hoursFrom(1) });
    });

    it("reads zero and no date for an owner without items", async () => {
      const ctx = options.context();
      const reader = options.createReader();

      expect(await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS)).toEqual({
        flashcard: NOTHING,
        exam_question: NOTHING,
        recall_question: NOTHING,
      });
    });

    it("lists each page with an item due today once, and never one due from tomorrow", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const due = await ctx.newPage();
      const tomorrow = await ctx.newPage();
      await ctx.addItem(due, { dueAt: hoursFrom(-30) });
      await ctx.addItem(due, { dueAt: new Date(UPCOMING_FROM.getTime() - 1) });
      await ctx.addItem(tomorrow, { dueAt: UPCOMING_FROM });

      const overview = await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS);

      expect(overview.flashcard.duePageIds).toEqual([due.pageId]);
    });

    it("lists the pages reviewed today per technique, once each, from the day's first instant", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const first = await ctx.newPage();
      const second = await ctx.newPage();
      const yesterday = await ctx.newPage();
      // Two reviews of one page today; the page is listed once.
      await ctx.addReviewedItem(first, {
        dueAt: hoursFrom(24),
        reviewedAt: REVIEWED_FROM,
      });
      await ctx.addReviewedItem(first, {
        dueAt: hoursFrom(48),
        reviewedAt: new Date(UPCOMING_FROM.getTime() - 1),
      });
      // Another technique on another page.
      await ctx.addReviewedItem(second, {
        kind: "exam_question",
        dueAt: hoursFrom(72),
        reviewedAt: hoursFrom(-3),
      });
      // Just before today started: not today's.
      await ctx.addReviewedItem(yesterday, {
        dueAt: hoursFrom(24),
        reviewedAt: new Date(REVIEWED_FROM.getTime() - 1),
      });

      const overview = await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS);

      expect(overview.flashcard.reviewedPageIds).toEqual([first.pageId]);
      expect(overview.exam_question.reviewedPageIds).toEqual([second.pageId]);
      expect(overview.recall_question.reviewedPageIds).toEqual([]);
      // Reviewed items are still live items.
      expect(overview.flashcard.total).toBe(3);
    });

    it("keeps a partially reviewed page in both lists, so it reads as pending", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      await ctx.addReviewedItem(page, {
        kind: "recall_question",
        dueAt: hoursFrom(24),
        reviewedAt: hoursFrom(-2),
      });
      await ctx.addItem(page, {
        kind: "recall_question",
        dueAt: hoursFrom(-1),
      });

      const overview = await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS);

      expect(overview.recall_question.duePageIds).toEqual([page.pageId]);
      expect(overview.recall_question.reviewedPageIds).toEqual([page.pageId]);
    });

    it("never lists reviews on archived pages or notebooks, nor another owner's", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const archivedPage = await ctx.newPage();
      const archivedNotebook = await ctx.newPage();
      const theirs = await ctx.newPage(ctx.otherOwnerId);
      for (const page of [archivedPage, archivedNotebook, theirs]) {
        await ctx.addReviewedItem(page, {
          dueAt: hoursFrom(24),
          reviewedAt: hoursFrom(-2),
        });
      }
      await ctx.archivePage(archivedPage);
      await ctx.archiveNotebook(archivedNotebook);

      expect(
        (await reader.readTechniqueSnapshot(ctx.ownerId, BOUNDS)).flashcard
          .reviewedPageIds,
      ).toEqual([]);
      expect(
        (await reader.readTechniqueSnapshot(ctx.otherOwnerId, BOUNDS)).flashcard
          .reviewedPageIds,
      ).toEqual([theirs.pageId]);
    });
  });
}
