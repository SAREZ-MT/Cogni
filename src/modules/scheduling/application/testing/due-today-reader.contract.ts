import { describe, expect, it } from "vitest";
import type { DueKind, DueTodayPage } from "../../domain/due-today";
import type {
  DueTodayReader,
  DueTodayReadOptions,
} from "../../domain/due-today-reader";

// A page created for a test, as the reader must describe it.
export interface DuePageFixture {
  readonly pageId: string;
  readonly pageTitle: string;
  readonly notebookId: string;
  readonly notebookTitle: string;
  readonly notebookColor: string | null;
}

export interface DueTodayReaderContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // Creates a page in a notebook of its own, owned by `ownerId` (default:
  // the context's ownerId). Async so the DB runner can insert real rows.
  readonly newPage: (ownerId?: string) => Promise<DuePageFixture>;
  // Adds one study item to the page, owned by the page's owner.
  readonly addItem: (
    page: DuePageFixture,
    input: { kind?: DueKind; dueAt: Date; suspended?: boolean },
  ) => Promise<void>;
  readonly archivePage: (page: DuePageFixture) => Promise<void>;
  readonly archiveNotebook: (page: DuePageFixture) => Promise<void>;
}

// Exam sessions for the "exams done on a completed session" rule (H2-T6).
export interface ExamSessionFixtures {
  // Adds one exam session on the page, owned by the page's owner, finished
  // at `finishedAt` (null: started and still open).
  readonly addExamSession: (
    page: DuePageFixture,
    finishedAt: Date | null,
  ) => Promise<void>;
}

export interface DueTodayReaderContractOptions {
  createReader(): DueTodayReader;
  context: () => DueTodayReaderContractContext & ExamSessionFixtures;
}

// The reader's bound: the start of the owner's next local day (the use
// case computes it). Items due before it are due today.
const NOW = new Date("2026-10-04T12:00:00.000Z");
const HOUR_MS = 3_600_000;
const hoursFromNow = (hours: number) =>
  new Date(NOW.getTime() + hours * HOUR_MS);

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it. The DB owner may hold rows from
// other tests, so every assertion looks only at the test's own pages.
export function runDueTodayReaderContract(
  options: DueTodayReaderContractOptions,
): void {
  const listFor = async (
    reader: DueTodayReader,
    ownerId: string,
    pages: readonly DuePageFixture[],
    dueBefore: Date = NOW,
    readOptions?: DueTodayReadOptions,
  ): Promise<DueTodayPage[]> => {
    const ids = new Set(pages.map((page) => page.pageId));
    return (await reader.listDueToday(ownerId, dueBefore, readOptions)).filter(
      (row) => ids.has(row.pageId),
    );
  };
  // "Today" for the exam rule: [TODAY_FROM, NOW).
  const TODAY_FROM = hoursFromNow(-24);

  describe("DueTodayReader contract", () => {
    it("describes a due page with its notebook, due counts per kind and earliest due", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      await ctx.addItem(page, { dueAt: hoursFromNow(-2) });
      await ctx.addItem(page, { dueAt: hoursFromNow(-5) });
      await ctx.addItem(page, {
        kind: "exam_question",
        dueAt: hoursFromNow(-1),
      });

      expect(await listFor(reader, ctx.ownerId, [page])).toEqual([
        {
          pageId: page.pageId,
          pageTitle: page.pageTitle,
          notebookId: page.notebookId,
          notebookTitle: page.notebookTitle,
          notebookColor: page.notebookColor,
          due: { flashcard: 2, exam_question: 1, recall_question: 0 },
          earliestDueAt: hoursFromNow(-5),
        },
      ]);
    });

    it("counts an item due just before the bound and never one due at or after it", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      const later = await ctx.newPage();
      const lastInstant = new Date(NOW.getTime() - 1);
      await ctx.addItem(page, { dueAt: lastInstant });
      await ctx.addItem(page, { dueAt: NOW });
      await ctx.addItem(later, { dueAt: hoursFromNow(1) });

      const rows = await listFor(reader, ctx.ownerId, [page, later]);
      expect(rows.map((row) => row.pageId)).toEqual([page.pageId]);
      expect(rows[0]?.due.flashcard).toBe(1);
      expect(rows[0]?.earliestDueAt).toEqual(lastInstant);
    });

    it("orders pages by their earliest due item, oldest first", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const recent = await ctx.newPage();
      const oldest = await ctx.newPage();
      const middle = await ctx.newPage();
      await ctx.addItem(recent, { dueAt: hoursFromNow(-1) });
      await ctx.addItem(oldest, { dueAt: hoursFromNow(-30) });
      await ctx.addItem(oldest, { dueAt: hoursFromNow(-0.5) });
      await ctx.addItem(middle, { dueAt: hoursFromNow(-10) });

      const rows = await listFor(reader, ctx.ownerId, [recent, oldest, middle]);
      expect(rows.map((row) => row.pageId)).toEqual([
        oldest.pageId,
        middle.pageId,
        recent.pageId,
      ]);
    });

    it("skips suspended items, and a page whose only due items are suspended", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const mixed = await ctx.newPage();
      const onlySuspended = await ctx.newPage();
      await ctx.addItem(mixed, { dueAt: hoursFromNow(-3), suspended: true });
      await ctx.addItem(mixed, { dueAt: hoursFromNow(-1) });
      await ctx.addItem(onlySuspended, {
        dueAt: hoursFromNow(-3),
        suspended: true,
      });

      const rows = await listFor(reader, ctx.ownerId, [mixed, onlySuspended]);
      expect(rows.map((row) => row.pageId)).toEqual([mixed.pageId]);
      expect(rows[0]?.due.flashcard).toBe(1);
      expect(rows[0]?.earliestDueAt).toEqual(hoursFromNow(-1));
    });

    it("leaves out archived pages and pages of archived notebooks", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const active = await ctx.newPage();
      const archivedPage = await ctx.newPage();
      const archivedNotebook = await ctx.newPage();
      for (const page of [active, archivedPage, archivedNotebook]) {
        await ctx.addItem(page, { dueAt: hoursFromNow(-1) });
      }
      await ctx.archivePage(archivedPage);
      await ctx.archiveNotebook(archivedNotebook);

      const rows = await listFor(reader, ctx.ownerId, [
        active,
        archivedPage,
        archivedNotebook,
      ]);
      expect(rows.map((row) => row.pageId)).toEqual([active.pageId]);
    });

    it("never lists another owner's pages", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const mine = await ctx.newPage();
      const theirs = await ctx.newPage(ctx.otherOwnerId);
      await ctx.addItem(mine, { dueAt: hoursFromNow(-1) });
      await ctx.addItem(theirs, { dueAt: hoursFromNow(-1) });

      expect(
        (await listFor(reader, ctx.ownerId, [mine, theirs])).map(
          (row) => row.pageId,
        ),
      ).toEqual([mine.pageId]);
      expect(
        (await listFor(reader, ctx.otherOwnerId, [mine, theirs])).map(
          (row) => row.pageId,
        ),
      ).toEqual([theirs.pageId]);
    });

    it("keeps due exam questions of a page whose exam was completed today unless asked", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      await ctx.addItem(page, {
        kind: "exam_question",
        dueAt: hoursFromNow(-2),
      });
      await ctx.addExamSession(page, hoursFromNow(-1));

      const rows = await listFor(reader, ctx.ownerId, [page]);
      expect(rows[0]?.due.exam_question).toBe(1);
    });

    it("drops the exam questions of a page whose exam was completed today when asked", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const mixed = await ctx.newPage();
      const examOnly = await ctx.newPage();
      const yesterday = await ctx.newPage();
      const open = await ctx.newPage();
      await ctx.addItem(mixed, {
        kind: "exam_question",
        dueAt: hoursFromNow(-30),
      });
      await ctx.addItem(mixed, { dueAt: hoursFromNow(-2) });
      await ctx.addExamSession(mixed, TODAY_FROM);
      await ctx.addItem(examOnly, {
        kind: "exam_question",
        dueAt: hoursFromNow(-3),
      });
      await ctx.addExamSession(examOnly, new Date(NOW.getTime() - 1));
      // Finished just before today started: not today's.
      await ctx.addItem(yesterday, {
        kind: "exam_question",
        dueAt: hoursFromNow(-4),
      });
      await ctx.addExamSession(yesterday, new Date(TODAY_FROM.getTime() - 1));
      // Started today and never finished.
      await ctx.addItem(open, {
        kind: "exam_question",
        dueAt: hoursFromNow(-5),
      });
      await ctx.addExamSession(open, null);

      const rows = await listFor(
        reader,
        ctx.ownerId,
        [mixed, examOnly, yesterday, open],
        NOW,
        { examsCompletedFrom: TODAY_FROM },
      );

      expect(rows.map((row) => row.pageId)).toEqual([
        open.pageId,
        yesterday.pageId,
        mixed.pageId,
      ]);
      const mixedRow = rows.find((row) => row.pageId === mixed.pageId);
      expect(mixedRow?.due).toEqual({
        flashcard: 1,
        exam_question: 0,
        recall_question: 0,
      });
      // The dropped exam question no longer sets the page's place.
      expect(mixedRow?.earliestDueAt).toEqual(hoursFromNow(-2));
    });
  });
}
