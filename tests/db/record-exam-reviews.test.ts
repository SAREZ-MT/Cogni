import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createExamReviewRecorder } from "@/modules/study-engine";
import { recordExamReviews } from "@/modules/study-engine/application/record-exam-reviews";
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

// recordExamReviews against Postgres: the reviews, their logs and the page
// mastery commit together, roll back together, and join (as a savepoint)
// the exams module's transaction through createExamReviewRecorder.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("exam-reviews-owner");
  const notebookId = randomUUID();
  let nextPagePosition = 1;
  const CREATED = new Date("2026-10-04T08:00:00.000Z");
  const NOW = new Date("2026-10-05T09:00:00.000Z");
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
    title: "Cuaderno de repasos de examen",
    position: 1,
  });

  // A page with two due root items.
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
    const roots = [randomUUID(), randomUUID()];
    const items = roots.map((rootId) =>
      newStudyItem({
        id: randomUUID(),
        ownerId: owner.id,
        pageId,
        kind: "exam_question",
        sourceId: rootId,
        now: CREATED,
      }),
    );
    const repo = new DrizzleStudyItemRepository(db);
    for (const item of items) await repo.save(item);
    return { pageId, roots, items, sessionId: randomUUID() };
  }

  async function stored(pageId: string, sessionId: string) {
    const items = await db
      .select()
      .from(studyItems)
      .where(eq(studyItems.pageId, pageId));
    const logs = await db
      .select()
      .from(reviewLogs)
      .where(eq(reviewLogs.sessionId, sessionId));
    const mastery = await db
      .select()
      .from(pageMastery)
      .where(eq(pageMastery.pageId, pageId));
    return { items, logs, mastery };
  }

  const answersFor = (roots: string[]) => [
    { rootId: roots[0] as string, correct: false },
    { rootId: roots[1] as string, correct: true },
  ];

  describe("recordExamReviews on Postgres", () => {
    it("commits the reviews, their exam logs and the page mastery together", async () => {
      const { pageId, roots, sessionId } = await fixture();

      const result = await createExamReviewRecorder({ db, ids }).record({
        ownerId: owner.id,
        sessionId,
        pageId,
        answers: answersFor(roots),
        now: NOW,
      });

      expect(result.ok).toBe(true);
      const after = await stored(pageId, sessionId);
      expect(after.logs.map((log) => log.quality).sort()).toEqual([1, 4]);
      expect(after.logs.every((log) => log.sessionKind === "exam")).toBe(true);
      expect(after.items.every((item) => item.lastReviewedAt !== null)).toBe(
        true,
      );
      expect(
        after.items.every(
          (item) => item.dueAt.getTime() === NOW.getTime() + DAY_MS,
        ),
      ).toBe(true);
      expect(after.mastery).toHaveLength(1);
    });

    it("rolls every write back when the mastery write fails", async () => {
      const { pageId, roots, sessionId } = await fixture();
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
        recordExamReviews(
          {
            ownerId: owner.id,
            sessionId,
            pageId,
            answers: answersFor(roots),
            now: NOW,
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
      const { pageId, roots, sessionId } = await fixture();

      await expect(
        db.transaction(async (tx) => {
          const result = await createExamReviewRecorder({
            db: tx,
            ids,
          }).record({
            ownerId: owner.id,
            sessionId,
            pageId,
            answers: answersFor(roots),
            now: NOW,
          });
          expect(result.ok).toBe(true);
          throw new Error("finishing the exam failed");
        }),
      ).rejects.toThrow("finishing the exam failed");

      const after = await stored(pageId, sessionId);
      expect(after.logs).toEqual([]);
      expect(after.mastery).toEqual([]);
    });
  });
}
