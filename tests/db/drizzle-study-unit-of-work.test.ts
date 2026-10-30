import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { gradeFlashcard } from "@/modules/study-engine/application/grade-flashcard";
import type { StudyUnitOfWork } from "@/modules/study-engine/application/study-unit-of-work";
import { STUDY_ENGINE_ERROR } from "@/modules/study-engine/domain/errors";
import { newFlashcardSession } from "@/modules/study-engine/domain/flashcard-session";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import { DrizzleFlashcardSessionRepository } from "@/modules/study-engine/infrastructure/drizzle-flashcard-session-repository";
import { DrizzleStudyItemRepository } from "@/modules/study-engine/infrastructure/drizzle-study-item-repository";
import { DrizzleStudyUnitOfWork } from "@/modules/study-engine/infrastructure/drizzle-study-unit-of-work";
import {
  flashcardSessions,
  notebooks,
  pageMastery,
  pages,
  profiles,
  reviewLogs,
  studyItems,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// The transactional grade path against Postgres: a graded answer writes the
// item's SM-2 state, its review log, the session counts and the page
// mastery together, rolls all of them back on a failure, and the item lock
// keeps two concurrent grades of one card from both applying SM-2.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  // A second connection, so two transactions can really overlap.
  const otherConnection = createTestDb();
  const owner = await createTestOwner("study-uow-owner");
  const otherOwner = await createTestOwner("study-uow-other");
  const notebookId = randomUUID();
  let nextPagePosition = 1;
  const CREATED = new Date("2026-10-04T08:00:00.000Z");
  const NOW = new Date("2026-10-04T09:00:00.000Z");
  const DAY_MS = 86_400_000;

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
      await deleteTestOwner(otherOwner.id);
    } finally {
      await db.$client.end();
      await otherConnection.$client.end();
    }
  });

  await db.insert(profiles).values([{ id: owner.id }, { id: otherOwner.id }]);
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno de la unidad de trabajo del motor",
    position: 1,
  });

  // A page with one due card and an open session over it.
  async function fixture(sessionOwner = owner.id) {
    const pageId = randomUUID();
    await db.insert(pages).values({
      id: pageId,
      ownerId: owner.id,
      notebookId,
      title: `Página ${pageId}`,
      content: { type: "doc", content: [] },
      position: nextPagePosition++,
    });
    const item = newStudyItem({
      id: randomUUID(),
      ownerId: owner.id,
      pageId,
      kind: "flashcard",
      sourceId: randomUUID(),
      now: CREATED,
    });
    await new DrizzleStudyItemRepository(db).save(item);
    const session = newFlashcardSession({
      id: randomUUID(),
      ownerId: sessionOwner,
      pageId: sessionOwner === owner.id ? pageId : null,
      now: NOW,
    });
    await new DrizzleFlashcardSessionRepository(db).insert(session);
    return { pageId, item, session };
  }

  const deps = (uow: StudyUnitOfWork) => ({
    uow,
    clock: createFixedClock(NOW),
    // Reviews are due per local day (UTC here): due before the next midnight.
    dueCutoff: () => new Date("2026-10-05T00:00:00.000Z"),
    ids: { next: () => randomUUID() },
  });

  async function stored(itemId: string, sessionId: string, pageId: string) {
    const [item] = await db
      .select()
      .from(studyItems)
      .where(eq(studyItems.id, itemId));
    const logs = await db
      .select()
      .from(reviewLogs)
      .where(eq(reviewLogs.itemId, itemId));
    const [session] = await db
      .select()
      .from(flashcardSessions)
      .where(eq(flashcardSessions.id, sessionId));
    const mastery = await db
      .select()
      .from(pageMastery)
      .where(eq(pageMastery.pageId, pageId));
    return { item, logs, session, mastery };
  }

  describe("DrizzleStudyUnitOfWork + gradeFlashcard", () => {
    it("commits the item, its log, the session counts and the page mastery together", async () => {
      const { pageId, item, session } = await fixture();

      const result = await gradeFlashcard(
        { sessionId: session.id, itemId: item.id, rating: "again" },
        deps(new DrizzleStudyUnitOfWork(db)),
        owner.id,
      );

      expect(result.ok).toBe(true);
      const after = await stored(item.id, session.id, pageId);
      expect(after.item).toMatchObject({
        intervalDays: 1,
        repetitions: 0,
        lapses: 1,
        lastQuality: 1,
        dueAt: new Date(NOW.getTime() + DAY_MS),
      });
      expect(after.logs).toHaveLength(1);
      expect(after.logs[0]).toMatchObject({
        quality: 1,
        intervalBefore: 0,
        intervalAfter: 1,
        sessionKind: "flashcards",
        sessionId: session.id,
      });
      expect(after.session).toMatchObject({ reviewedCount: 1, againCount: 1 });
      expect(after.mastery).toHaveLength(1);
      expect(after.mastery[0]).toMatchObject({
        ownerId: owner.id,
        level: "Aprendiendo",
        itemsTotal: 1,
        itemsDue: 0,
      });
    });

    it("rolls every write back when a later step fails", async () => {
      const { pageId, item, session } = await fixture();
      const real = new DrizzleStudyUnitOfWork(db);
      // The mastery upsert, the last write, blows up.
      const failing: StudyUnitOfWork = {
        run: (work) =>
          real.run((repos) =>
            work({
              ...repos,
              pageMastery: {
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
        gradeFlashcard(
          { sessionId: session.id, itemId: item.id, rating: "good" },
          deps(failing),
          owner.id,
        ),
      ).rejects.toThrow("mastery write failed");

      const after = await stored(item.id, session.id, pageId);
      expect(after.item).toMatchObject({
        repetitions: 0,
        intervalDays: 0,
        lastQuality: null,
        dueAt: CREATED,
      });
      expect(after.logs).toEqual([]);
      expect(after.session).toMatchObject({ reviewedCount: 0, againCount: 0 });
      expect(after.mastery).toEqual([]);
    });

    it("refuses another owner's card, even through their own session", async () => {
      const { pageId, item, session } = await fixture(otherOwner.id);

      const result = await gradeFlashcard(
        { sessionId: session.id, itemId: item.id, rating: "good" },
        deps(new DrizzleStudyUnitOfWork(db)),
        otherOwner.id,
      );

      expect(!result.ok && result.error.code).toBe(
        STUDY_ENGINE_ERROR.ITEM_NOT_FOUND,
      );
      const after = await stored(item.id, session.id, pageId);
      expect(after.logs).toEqual([]);
      expect(after.mastery).toEqual([]);
    });

    it("applies SM-2 once when the same card is graded twice concurrently", async () => {
      const { pageId, item, session } = await fixture();
      const input = { sessionId: session.id, itemId: item.id };

      const results = await Promise.all([
        gradeFlashcard(
          { ...input, rating: "good" },
          deps(new DrizzleStudyUnitOfWork(db)),
          owner.id,
        ),
        gradeFlashcard(
          { ...input, rating: "easy" },
          deps(new DrizzleStudyUnitOfWork(otherConnection)),
          owner.id,
        ),
      ]);

      const refused = results.filter((result) => !result.ok);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(refused).toHaveLength(1);
      expect(!refused[0]?.ok && refused[0]?.error.code).toBe(
        STUDY_ENGINE_ERROR.ITEM_NOT_DUE,
      );
      const after = await stored(item.id, session.id, pageId);
      expect(after.item?.repetitions).toBe(1);
      expect(after.logs).toHaveLength(1);
      expect(after.session?.reviewedCount).toBe(1);
    });
  });
}
