import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createRecallReviewRecorder } from "@/modules/study-engine";
import { recordRecallReviews } from "@/modules/study-engine/application/record-recall-reviews";
import type { StudyUnitOfWork } from "@/modules/study-engine/application/study-unit-of-work";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import { DrizzleStudyItemRepository } from "@/modules/study-engine/infrastructure/drizzle-study-item-repository";
import { DrizzleStudyUnitOfWork } from "@/modules/study-engine/infrastructure/drizzle-study-unit-of-work";
import {
  notebooks,
  pageMastery,
  pages,
  profiles,
  reviewLogs,
  studyItems,
} from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// recordRecallReviews against Postgres: the reviews, their recall logs and
// the page mastery commit together, roll back together, join (as a
// savepoint) the active-recall transaction through
// createRecallReviewRecorder, and a replayed (session, item) never logs
// twice, even when two recordings race.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("recall-reviews-owner");
  const notebookId = randomUUID();
  let nextPagePosition = 1;
  const CREATED = new Date("2026-10-05T08:00:00.000Z");
  const NOW = new Date("2026-10-06T09:00:00.000Z");
  // Reviews are due per local day (UTC here): due before the next midnight.
  const TOMORROW = new Date("2026-10-07T00:00:00.000Z");
  const DAY_MS = 86_400_000;
  const ids = { next: () => randomUUID() };

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values({ id: owner.id });
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno de repasos de recordación",
    position: 1,
  });

  // A page with two new (due) recall question items.
  async function fixture() {
    const pageId = randomUUID();
    await db.insert(pages).values({
      id: pageId,
      ownerId: owner.id,
      notebookId,
      title: `Página ${pageId}`,
      content: { type: "doc", content: [] },
      position: nextPagePosition++,
    });
    const questions = [randomUUID(), randomUUID()];
    const items = questions.map((questionId) =>
      newStudyItem({
        id: randomUUID(),
        ownerId: owner.id,
        pageId,
        kind: "recall_question",
        sourceId: questionId,
        now: CREATED,
      }),
    );
    const repo = new DrizzleStudyItemRepository(db);
    for (const item of items) await repo.save(item);
    return { pageId, questions, sessionId: randomUUID() };
  }

  async function stored(pageId: string, sessionId: string) {
    const items = await db
      .select()
      .from(studyItems)
      .where(eq(studyItems.pageId, pageId));
    const logs = await db
      .select()
      .from(reviewLogs)
      .where(
        and(
          eq(reviewLogs.sessionId, sessionId),
          eq(reviewLogs.sessionKind, "recall"),
        ),
      );
    const mastery = await db
      .select()
      .from(pageMastery)
      .where(eq(pageMastery.pageId, pageId));
    return { items, logs, mastery };
  }

  const reviewsFor = (questions: string[]) => [
    { questionId: questions[0] as string, quality: 2 },
    { questionId: questions[1] as string, quality: 5 },
  ];

  // Each recording is a dozen round trips to the remote cogni-dev
  // database; the replay and race cases make two of them.
  describe("recordRecallReviews on Postgres", { timeout: 20_000 }, () => {
    it("commits the reviews, their recall logs and the page mastery together", async () => {
      const { pageId, questions, sessionId } = await fixture();

      const result = await createRecallReviewRecorder({ db, ids }).record({
        ownerId: owner.id,
        sessionId,
        pageId,
        reviews: reviewsFor(questions),
        now: NOW,
        dueBefore: TOMORROW,
      });

      expect(result.ok).toBe(true);
      const after = await stored(pageId, sessionId);
      expect(after.logs.map((log) => log.quality).sort()).toEqual([2, 5]);
      expect(after.items.map((item) => item.lastQuality).sort()).toEqual([
        2, 5,
      ]);
      expect(
        after.items.every(
          (item) => item.dueAt.getTime() === NOW.getTime() + DAY_MS,
        ),
      ).toBe(true);
      expect(after.mastery).toHaveLength(1);
    });

    it("rolls every write back when the mastery write fails", async () => {
      const { pageId, questions, sessionId } = await fixture();
      const real = new DrizzleStudyUnitOfWork(db);
      const failing: StudyUnitOfWork = {
        run: (work) =>
          real.run((repos) =>
            work({
              ...repos,
              pageMastery: {
                ...repos.pageMastery,
                upsert: async () => {
                  throw new Error("mastery write failed");
                },
                getByPage: (id, ownerId) =>
                  repos.pageMastery.getByPage(id, ownerId),
                listByOwner: (ownerId) =>
                  repos.pageMastery.listByOwner(ownerId),
              },
            }),
          ),
      };

      await expect(
        recordRecallReviews(
          {
            ownerId: owner.id,
            sessionId,
            pageId,
            reviews: reviewsFor(questions),
            now: NOW,
            dueBefore: TOMORROW,
          },
          { uow: failing, ids },
        ),
      ).rejects.toThrow("mastery write failed");

      const after = await stored(pageId, sessionId);
      expect(after.logs).toEqual([]);
      expect(after.items.every((item) => item.lastReviewedAt === null)).toBe(
        true,
      );
      expect(after.mastery).toEqual([]);
    });

    it("rolls back with the caller's transaction it joined", async () => {
      const { pageId, questions, sessionId } = await fixture();

      await expect(
        db.transaction(async (tx) => {
          const result = await createRecallReviewRecorder({
            db: tx,
            ids,
          }).record({
            ownerId: owner.id,
            sessionId,
            pageId,
            reviews: reviewsFor(questions),
            now: NOW,
            dueBefore: TOMORROW,
          });
          expect(result.ok).toBe(true);
          throw new Error("saving the evaluations failed");
        }),
      ).rejects.toThrow("saving the evaluations failed");

      const after = await stored(pageId, sessionId);
      expect(after.logs).toEqual([]);
      expect(after.mastery).toEqual([]);
      expect(after.items.every((item) => item.lastReviewedAt === null)).toBe(
        true,
      );
    });

    it("records a retried answer later and never logs a (session, item) twice", async () => {
      const { pageId, questions, sessionId } = await fixture();
      const recorder = createRecallReviewRecorder({ db, ids });
      const first = await recorder.record({
        ownerId: owner.id,
        sessionId,
        pageId,
        reviews: [{ questionId: questions[0] as string, quality: 1 }],
        now: NOW,
        dueBefore: TOMORROW,
      });
      expect(first.ok).toBe(true);

      const retry = await recorder.record({
        ownerId: owner.id,
        sessionId,
        pageId,
        reviews: [
          { questionId: questions[0] as string, quality: 0 },
          { questionId: questions[1] as string, quality: 4 },
        ],
        now: new Date(NOW.getTime() + 60_000),
        dueBefore: TOMORROW,
      });

      expect(retry.ok && retry.value).toMatchObject({
        reviewedQuestionIds: [questions[1]],
        alreadyRecordedQuestionIds: [questions[0]],
      });
      const after = await stored(pageId, sessionId);
      expect(after.logs.map((log) => log.quality).sort()).toEqual([1, 4]);
    });

    it("logs one review when two recordings of the same answer race", async () => {
      const { pageId, questions, sessionId } = await fixture();
      const record = () =>
        createRecallReviewRecorder({ db, ids }).record({
          ownerId: owner.id,
          sessionId,
          pageId,
          reviews: [{ questionId: questions[0] as string, quality: 1 }],
          now: NOW,
          dueBefore: TOMORROW,
        });

      const results = await Promise.all([record(), record()]);

      expect(results.every((result) => result.ok)).toBe(true);
      const after = await stored(pageId, sessionId);
      expect(after.logs).toHaveLength(1);
      const replays = results.flatMap((result) =>
        result.ok ? result.value.alreadyRecordedQuestionIds : [],
      );
      expect(replays).toEqual([questions[0]]);
    });
  });
}
