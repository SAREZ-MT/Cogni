import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { recomputeAllPageMastery } from "@/modules/study-engine/application/recompute-all-page-mastery";
import { computeMastery } from "@/modules/study-engine/domain/mastery";
import type { StudiedPageReader } from "@/modules/study-engine/domain/studied-page-reader";
import {
  newStudyItem,
  type StudyItem,
} from "@/modules/study-engine/domain/study-item";
import { DrizzlePageMasteryRepository } from "@/modules/study-engine/infrastructure/drizzle-page-mastery-repository";
import { DrizzleStudyItemRepository } from "@/modules/study-engine/infrastructure/drizzle-study-item-repository";
import { DrizzleStudyUnitOfWork } from "@/modules/study-engine/infrastructure/drizzle-study-unit-of-work";
import { notebooks, pages, profiles } from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// The daily mastery job against a concurrent grade (R3-stale-overwrite-race):
// while a grade holds its item's row lock, the job's per-page unit of work
// waits on the page lock, then reads the graded item, so it can never write
// a mastery computed from the pre-grade state over the grade's fresher row.
// The wait is bounded (R3-unbounded-page-lock-wait): a lock held past the
// job's lock timeout fails that page instead of stalling the run.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  // A second connection, so the grade and the job really overlap.
  const jobConnection = createTestDb();
  const owner = await createTestOwner("mastery-race-owner");
  const notebookId = randomUUID();
  const CREATED = new Date("2026-10-01T08:00:00.000Z");
  const GRADED_AT = new Date("2026-10-04T06:30:00.000Z");
  const JOB_NOW = new Date("2026-10-04T06:30:01.000Z");
  const DAY_MS = 86_400_000;

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
      await jobConnection.$client.end();
    }
  });

  // Open the job's connection now, so its connect latency never counts
  // toward the "still waiting for the lock" window below.
  await jobConnection.execute(sql`select 1`);
  await db.insert(profiles).values({ id: owner.id });
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno de la carrera de dominio",
    position: 1,
  });

  describe("recomputeAllPageMastery against a concurrent grade", () => {
    it("waits for the grade's item lock and writes mastery from the graded item", async () => {
      const pageId = randomUUID();
      await db.insert(pages).values({
        id: pageId,
        ownerId: owner.id,
        notebookId,
        title: `Página ${pageId}`,
        content: { type: "doc", content: [] },
        position: 1,
      });
      const due = newStudyItem({
        id: randomUUID(),
        ownerId: owner.id,
        pageId,
        kind: "flashcard",
        sourceId: randomUUID(),
        now: CREATED,
      });
      await new DrizzleStudyItemRepository(db).save(due);

      // Only this page, so the job never touches other suites' rows.
      const reader: StudiedPageReader = {
        listStalePages: async ({ after }) =>
          after === null
            ? [{ pageId, ownerId: owner.id, masteryComputedAt: null }]
            : [],
      };

      let releaseGrade = () => {};
      const gradeMayCommit = new Promise<void>((resolve) => {
        releaseGrade = resolve;
      });
      let lockHeld = () => {};
      const gradeHoldsLock = new Promise<void>((resolve) => {
        lockHeld = resolve;
      });

      // The grade's shape (gradeFlashcard): lock the item, write it, then
      // the page's mastery, all in one transaction.
      const grade = db.transaction(async (tx) => {
        const items = new DrizzleStudyItemRepository(tx);
        await items.lock(due.id, owner.id);
        lockHeld();
        await gradeMayCommit;
        const graded: StudyItem = {
          ...due,
          intervalDays: 6,
          repetitions: 1,
          lastQuality: 5,
          lastReviewedAt: GRADED_AT,
          dueAt: new Date(GRADED_AT.getTime() + 6 * DAY_MS),
          updatedAt: GRADED_AT,
        };
        await items.save(graded);
        await new DrizzlePageMasteryRepository(tx).upsert({
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          ...computeMastery([graded], GRADED_AT),
          computedAt: GRADED_AT,
        });
      });

      await gradeHoldsLock;
      let jobSettled = false;
      const job = recomputeAllPageMastery({
        pages: reader,
        uow: new DrizzleStudyUnitOfWork(jobConnection),
        clock: createFixedClock(JOB_NOW),
        ids: { next: randomUUID },
        timeBudgetMs: 60_000,
      }).finally(() => {
        jobSettled = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(jobSettled).toBe(false);

      releaseGrade();
      await grade;
      const summary = await job;

      expect(summary).toEqual({
        pagesRecomputed: 1,
        pagesFailed: 0,
        complete: true,
      });
      const stored = await new DrizzlePageMasteryRepository(db).getByPage(
        pageId,
        owner.id,
      );
      expect(stored).toMatchObject({
        itemsTotal: 1,
        itemsDue: 0,
        computedAt: JOB_NOW,
      });
    });

    it("gives up on a page whose items stay locked past the lock timeout and finishes the run", async () => {
      const pageId = randomUUID();
      await db.insert(pages).values({
        id: pageId,
        ownerId: owner.id,
        notebookId,
        title: `Página ${pageId}`,
        content: { type: "doc", content: [] },
        position: 1,
      });
      const held = newStudyItem({
        id: randomUUID(),
        ownerId: owner.id,
        pageId,
        kind: "flashcard",
        sourceId: randomUUID(),
        now: CREATED,
      });
      await new DrizzleStudyItemRepository(db).save(held);
      const reader: StudiedPageReader = {
        listStalePages: async ({ after }) =>
          after === null
            ? [{ pageId, ownerId: owner.id, masteryComputedAt: null }]
            : [],
      };

      let releaseLock = () => {};
      const lockMayEnd = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      let lockHeld = () => {};
      const holderHoldsLock = new Promise<void>((resolve) => {
        lockHeld = resolve;
      });
      // A writer that keeps the item locked far longer than the job waits.
      const holder = db.transaction(async (tx) => {
        await new DrizzleStudyItemRepository(tx).lock(held.id, owner.id);
        lockHeld();
        await lockMayEnd;
      });

      // `db` has a single connection and the holder's transaction owns it
      // until released: every read on `db` waits until after `finally`.
      const errors: unknown[] = [];
      let summary: Awaited<ReturnType<typeof recomputeAllPageMastery>>;
      try {
        await holderHoldsLock;
        summary = await recomputeAllPageMastery({
          pages: reader,
          uow: new DrizzleStudyUnitOfWork(jobConnection),
          clock: createFixedClock(JOB_NOW),
          ids: { next: randomUUID },
          timeBudgetMs: 60_000,
          pageLockTimeoutMs: 300,
          onPageError: (_page, error) => errors.push(error),
        });
      } finally {
        releaseLock();
        await holder;
      }

      expect(summary).toEqual({
        pagesRecomputed: 0,
        pagesFailed: 1,
        complete: true,
      });
      expect(errors).toHaveLength(1);
      // Drizzle wraps the driver error; its cause is Postgres's
      // lock_not_available (SQLSTATE 55P03).
      expect((errors[0] as { cause?: { code?: string } }).cause?.code).toBe(
        "55P03",
      );
      expect(
        await new DrizzlePageMasteryRepository(db).getByPage(pageId, owner.id),
      ).toBeNull();

      // The bound is transaction-local: the job's connection waits normally
      // again afterwards (no lock_timeout left on the session).
      const [setting] = await jobConnection.execute<{ lock_timeout: string }>(
        sql`show lock_timeout`,
      );
      expect(setting?.lock_timeout).toBe("0");
    });
  });
}
