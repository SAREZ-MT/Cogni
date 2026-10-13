import { describe, expect, it } from "vitest";
import type { MasteryLevelName } from "../../domain/progress";
import type {
  AnswerOutcomeReader,
  PageProgressReader,
  ReviewHistoryReader,
} from "../../domain/readers";
import type { ReviewBucket } from "../../domain/streak";
import type { Technique } from "../../domain/technique";

export interface AnalyticsPageFixture {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  notebookColor: string | null;
}

// Seeds the fixtures each implementation reads: notebooks, pages,
// study_items, page_mastery, review_logs, exam and recall answers.
export interface AnalyticsReadersContractContext {
  ownerId: string;
  otherOwnerId: string;
  // A page in a new notebook, or in `sameNotebookAs`'s notebook. Every new
  // notebook and page is positioned after the previous ones.
  newPage(input?: {
    ownerId?: string;
    sameNotebookAs?: AnalyticsPageFixture;
  }): Promise<AnalyticsPageFixture>;
  addItem(
    page: AnalyticsPageFixture,
    input: { dueAt: Date; suspended?: boolean },
  ): Promise<void>;
  setMastery(
    page: AnalyticsPageFixture,
    input: { level: MasteryLevelName; score: number },
  ): Promise<void>;
  addReview(
    page: AnalyticsPageFixture,
    input: { technique: Technique; quality: number; reviewedAt: Date },
  ): Promise<void>;
  addExamAnswer(
    page: AnalyticsPageFixture,
    input: { isCorrect: boolean; answeredAt: Date; finished?: boolean },
  ): Promise<void>;
  addRecallAnswer(
    page: AnalyticsPageFixture,
    input: {
      selfRating: number;
      aiScore: number | null;
      status: "pending" | "done" | "failed";
      answeredAt: Date;
    },
  ): Promise<void>;
  archivePage(page: AnalyticsPageFixture): Promise<void>;
  archiveNotebook(page: AnalyticsPageFixture): Promise<void>;
}

export interface AnalyticsReadersContractOptions {
  createReaders(): {
    reviews: ReviewHistoryReader;
    pages: PageProgressReader;
    answers: AnswerOutcomeReader;
  };
  context: () => AnalyticsReadersContractContext;
}

const FROM = new Date("2026-10-05T00:00:00.000Z");
const TO = new Date("2026-10-12T00:00:00.000Z");
const HOUR_MS = 3_600_000;
const hoursFromStart = (hours: number) =>
  new Date(FROM.getTime() + hours * HOUR_MS);

// The bucket reads have no page to filter by, and the DB owner may hold
// rows from other tests, so each bucket test writes on a day of its own
// and only looks at that day.
const bucketsOn = (buckets: ReviewBucket[], day: string): ReviewBucket[] => {
  const start = new Date(`${day}T00:00:00.000Z`).getTime();
  return buckets.filter(
    (bucket) =>
      bucket.startsAt.getTime() >= start &&
      bucket.startsAt.getTime() < start + 24 * HOUR_MS,
  );
};

const onlyPages = <T extends { pageId: string }>(
  rows: T[],
  pages: readonly AnalyticsPageFixture[],
): T[] => {
  const ids = new Set(pages.map((page) => page.pageId));
  return rows.filter((row) => ids.has(row.pageId));
};

// Shared by the in-memory fake (unit suite) and the Drizzle readers
// (`pnpm test:db`); both must satisfy it.
export function runAnalyticsReadersContract(
  options: AnalyticsReadersContractOptions,
): void {
  describe("ReviewHistoryReader contract", () => {
    it("describes each review in the range with its page, notebook, technique and quality", async () => {
      const ctx = options.context();
      const { reviews } = options.createReaders();
      const page = await ctx.newPage();
      await ctx.addReview(page, {
        technique: "exam",
        quality: 2,
        reviewedAt: hoursFromStart(30),
      });
      await ctx.addReview(page, {
        technique: "flashcards",
        quality: 5,
        reviewedAt: hoursFromStart(3),
      });

      expect(
        onlyPages(await reviews.listReviews(ctx.ownerId, FROM, TO), [page]),
      ).toEqual([
        {
          pageId: page.pageId,
          notebookId: page.notebookId,
          technique: "flashcards",
          quality: 5,
          reviewedAt: hoursFromStart(3),
        },
        {
          pageId: page.pageId,
          notebookId: page.notebookId,
          technique: "exam",
          quality: 2,
          reviewedAt: hoursFromStart(30),
        },
      ]);
    });

    it("includes the range start and excludes its end", async () => {
      const ctx = options.context();
      const { reviews } = options.createReaders();
      const page = await ctx.newPage();
      for (const reviewedAt of [
        new Date(FROM.getTime() - 1),
        FROM,
        new Date(TO.getTime() - 1),
        TO,
      ]) {
        await ctx.addReview(page, {
          technique: "recall",
          quality: 3,
          reviewedAt,
        });
      }

      const rows = onlyPages(await reviews.listReviews(ctx.ownerId, FROM, TO), [
        page,
      ]);
      expect(rows.map((row) => row.reviewedAt)).toEqual([
        FROM,
        new Date(TO.getTime() - 1),
      ]);
    });

    it("never returns another owner's reviews", async () => {
      const ctx = options.context();
      const { reviews } = options.createReaders();
      const theirs = await ctx.newPage({ ownerId: ctx.otherOwnerId });
      await ctx.addReview(theirs, {
        technique: "flashcards",
        quality: 4,
        reviewedAt: hoursFromStart(1),
      });

      expect(
        onlyPages(await reviews.listReviews(ctx.ownerId, FROM, TO), [theirs]),
      ).toEqual([]);
    });

    it("leaves out archived pages and pages of archived notebooks", async () => {
      const ctx = options.context();
      const { reviews } = options.createReaders();
      const active = await ctx.newPage();
      const archivedPage = await ctx.newPage();
      const archivedNotebook = await ctx.newPage();
      for (const page of [active, archivedPage, archivedNotebook]) {
        await ctx.addReview(page, {
          technique: "flashcards",
          quality: 4,
          reviewedAt: hoursFromStart(1),
        });
      }
      await ctx.archivePage(archivedPage);
      await ctx.archiveNotebook(archivedNotebook);

      const rows = onlyPages(await reviews.listReviews(ctx.ownerId, FROM, TO), [
        active,
        archivedPage,
        archivedNotebook,
      ]);
      expect(rows.map((row) => row.pageId)).toEqual([active.pageId]);
    });

    it("reduces the history to distinct technique and 15-minute buckets", async () => {
      const ctx = options.context();
      const { reviews } = options.createReaders();
      const page = await ctx.newPage();
      const day = "2001-03-04";
      const at = (time: string) => new Date(`${day}T${time}Z`);
      for (const [technique, time] of [
        ["flashcards", "10:01:00"],
        ["flashcards", "10:14:59.999"],
        ["flashcards", "10:15:00"],
        ["exam", "10:05:00"],
        ["recall", "23:59:00"],
      ] as const) {
        await ctx.addReview(page, {
          technique,
          quality: 3,
          reviewedAt: at(time),
        });
      }

      expect(
        bucketsOn(await reviews.listReviewBuckets(ctx.ownerId), day),
      ).toEqual([
        { technique: "exam", startsAt: at("10:00:00") },
        { technique: "flashcards", startsAt: at("10:00:00") },
        { technique: "flashcards", startsAt: at("10:15:00") },
        { technique: "recall", startsAt: at("23:45:00") },
      ]);
    });

    it("keeps buckets owner-scoped and skips archived pages and notebooks", async () => {
      const ctx = options.context();
      const { reviews } = options.createReaders();
      const day = "2001-05-06";
      const theirs = await ctx.newPage({ ownerId: ctx.otherOwnerId });
      const archivedPage = await ctx.newPage();
      const archivedNotebook = await ctx.newPage();
      for (const page of [theirs, archivedPage, archivedNotebook]) {
        await ctx.addReview(page, {
          technique: "flashcards",
          quality: 4,
          reviewedAt: new Date(`${day}T08:00:00Z`),
        });
      }
      await ctx.archivePage(archivedPage);
      await ctx.archiveNotebook(archivedNotebook);

      expect(
        bucketsOn(await reviews.listReviewBuckets(ctx.ownerId), day),
      ).toEqual([]);
    });
  });

  describe("PageProgressReader contract", () => {
    const NOW = new Date("2026-10-13T12:00:00.000Z");

    it("describes each page with its notebook, mastery and live item counts", async () => {
      const ctx = options.context();
      const { pages } = options.createReaders();
      const page = await ctx.newPage();
      await ctx.setMastery(page, { level: "Consolidando", score: 0.5 });
      await ctx.addItem(page, { dueAt: new Date(NOW.getTime() - HOUR_MS) });
      // Due exactly now counts as due.
      await ctx.addItem(page, { dueAt: NOW });
      await ctx.addItem(page, { dueAt: new Date(NOW.getTime() + 1) });
      await ctx.addItem(page, {
        dueAt: new Date(NOW.getTime() - HOUR_MS),
        suspended: true,
      });

      expect(
        onlyPages(await pages.listPageProgress(ctx.ownerId, NOW), [page]),
      ).toEqual([
        {
          pageId: page.pageId,
          pageTitle: page.pageTitle,
          notebookId: page.notebookId,
          notebookTitle: page.notebookTitle,
          notebookColor: page.notebookColor,
          level: "Consolidando",
          score: 0.5,
          itemsTotal: 3,
          itemsDue: 2,
        },
      ]);
    });

    it("lists a page never reviewed and without items", async () => {
      const ctx = options.context();
      const { pages } = options.createReaders();
      const page = await ctx.newPage();

      expect(
        onlyPages(await pages.listPageProgress(ctx.ownerId, NOW), [page]),
      ).toEqual([
        expect.objectContaining({
          pageId: page.pageId,
          level: null,
          score: null,
          itemsTotal: 0,
          itemsDue: 0,
        }),
      ]);
    });

    it("orders pages by notebook position, then page position", async () => {
      const ctx = options.context();
      const { pages } = options.createReaders();
      const first = await ctx.newPage();
      const second = await ctx.newPage();
      const firstAgain = await ctx.newPage({ sameNotebookAs: first });

      const rows = onlyPages(await pages.listPageProgress(ctx.ownerId, NOW), [
        first,
        second,
        firstAgain,
      ]);
      expect(rows.map((row) => row.pageId)).toEqual([
        first.pageId,
        firstAgain.pageId,
        second.pageId,
      ]);
    });

    it("keeps the read owner-scoped and skips archived pages and notebooks", async () => {
      const ctx = options.context();
      const { pages } = options.createReaders();
      const active = await ctx.newPage();
      const theirs = await ctx.newPage({ ownerId: ctx.otherOwnerId });
      const archivedPage = await ctx.newPage();
      const archivedNotebook = await ctx.newPage();
      await ctx.archivePage(archivedPage);
      await ctx.archiveNotebook(archivedNotebook);

      const rows = onlyPages(await pages.listPageProgress(ctx.ownerId, NOW), [
        active,
        theirs,
        archivedPage,
        archivedNotebook,
      ]);
      expect(rows.map((row) => row.pageId)).toEqual([active.pageId]);
    });
  });

  describe("AnswerOutcomeReader contract", () => {
    it("lists the answers of finished exams in the range", async () => {
      const ctx = options.context();
      const { answers } = options.createReaders();
      const page = await ctx.newPage();
      await ctx.addExamAnswer(page, {
        isCorrect: false,
        answeredAt: hoursFromStart(20),
      });
      await ctx.addExamAnswer(page, {
        isCorrect: true,
        answeredAt: hoursFromStart(2),
      });
      await ctx.addExamAnswer(page, {
        isCorrect: true,
        answeredAt: hoursFromStart(4),
        finished: false,
      });

      expect(
        onlyPages(await answers.listExamAnswers(ctx.ownerId, FROM, TO), [page]),
      ).toEqual([
        { pageId: page.pageId, isCorrect: true, answeredAt: hoursFromStart(2) },
        {
          pageId: page.pageId,
          isCorrect: false,
          answeredAt: hoursFromStart(20),
        },
      ]);
    });

    it("bounds exam answers by [from, to)", async () => {
      const ctx = options.context();
      const { answers } = options.createReaders();
      const page = await ctx.newPage();
      for (const answeredAt of [
        new Date(FROM.getTime() - 1),
        FROM,
        new Date(TO.getTime() - 1),
        TO,
      ]) {
        await ctx.addExamAnswer(page, { isCorrect: true, answeredAt });
      }

      const rows = onlyPages(
        await answers.listExamAnswers(ctx.ownerId, FROM, TO),
        [page],
      );
      expect(rows.map((row) => row.answeredAt)).toEqual([
        FROM,
        new Date(TO.getTime() - 1),
      ]);
    });

    it("lists the evaluated recall answers in the range with their ratings", async () => {
      const ctx = options.context();
      const { answers } = options.createReaders();
      const page = await ctx.newPage();
      await ctx.addRecallAnswer(page, {
        selfRating: 5,
        aiScore: 1,
        status: "done",
        answeredAt: hoursFromStart(6),
      });
      await ctx.addRecallAnswer(page, {
        selfRating: 2,
        aiScore: null,
        status: "pending",
        answeredAt: hoursFromStart(7),
      });
      await ctx.addRecallAnswer(page, {
        selfRating: 2,
        aiScore: null,
        status: "failed",
        answeredAt: hoursFromStart(8),
      });

      expect(
        onlyPages(await answers.listRecallAnswers(ctx.ownerId, FROM, TO), [
          page,
        ]),
      ).toEqual([
        {
          pageId: page.pageId,
          pageTitle: page.pageTitle,
          notebookId: page.notebookId,
          notebookTitle: page.notebookTitle,
          selfRating: 5,
          aiScore: 1,
          answeredAt: hoursFromStart(6),
        },
      ]);
    });

    it("bounds recall answers by [from, to)", async () => {
      const ctx = options.context();
      const { answers } = options.createReaders();
      const page = await ctx.newPage();
      for (const answeredAt of [
        new Date(FROM.getTime() - 1),
        FROM,
        new Date(TO.getTime() - 1),
        TO,
      ]) {
        await ctx.addRecallAnswer(page, {
          selfRating: 3,
          aiScore: 3,
          status: "done",
          answeredAt,
        });
      }

      const rows = onlyPages(
        await answers.listRecallAnswers(ctx.ownerId, FROM, TO),
        [page],
      );
      expect(rows.map((row) => row.answeredAt)).toEqual([
        FROM,
        new Date(TO.getTime() - 1),
      ]);
    });

    const unreadablePages = async (ctx: AnalyticsReadersContractContext) => {
      const theirs = await ctx.newPage({ ownerId: ctx.otherOwnerId });
      const archivedPage = await ctx.newPage();
      const archivedNotebook = await ctx.newPage();
      return {
        all: [theirs, archivedPage, archivedNotebook],
        archive: async () => {
          await ctx.archivePage(archivedPage);
          await ctx.archiveNotebook(archivedNotebook);
        },
      };
    };

    it("keeps exam answers owner-scoped and skips archived pages and notebooks", async () => {
      const ctx = options.context();
      const { answers } = options.createReaders();
      const { all, archive } = await unreadablePages(ctx);
      for (const page of all) {
        await ctx.addExamAnswer(page, {
          isCorrect: true,
          answeredAt: hoursFromStart(1),
        });
      }
      await archive();

      expect(
        onlyPages(await answers.listExamAnswers(ctx.ownerId, FROM, TO), all),
      ).toEqual([]);
    });

    it("keeps recall answers owner-scoped and skips archived pages and notebooks", async () => {
      const ctx = options.context();
      const { answers } = options.createReaders();
      const { all, archive } = await unreadablePages(ctx);
      for (const page of all) {
        await ctx.addRecallAnswer(page, {
          selfRating: 4,
          aiScore: 4,
          status: "done",
          answeredAt: hoursFromStart(1),
        });
      }
      await archive();

      expect(
        onlyPages(await answers.listRecallAnswers(ctx.ownerId, FROM, TO), all),
      ).toEqual([]);
    });
  });
}
