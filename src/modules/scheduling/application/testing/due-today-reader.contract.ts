import { describe, expect, it } from "vitest";
import type { DueKind, DueTodayPage } from "../../domain/due-today";
import type { DueTodayReader } from "../../domain/due-today-reader";

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

export interface DueTodayReaderContractOptions {
  createReader(): DueTodayReader;
  context: () => DueTodayReaderContractContext;
}

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
    now: Date = NOW,
  ): Promise<DueTodayPage[]> => {
    const ids = new Set(pages.map((page) => page.pageId));
    return (await reader.listDueToday(ownerId, now)).filter((row) =>
      ids.has(row.pageId),
    );
  };

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

    it("counts an item due exactly now and never one due later", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      const later = await ctx.newPage();
      await ctx.addItem(page, { dueAt: NOW });
      await ctx.addItem(page, { dueAt: hoursFromNow(1) });
      await ctx.addItem(later, { dueAt: new Date(NOW.getTime() + 1) });

      const rows = await listFor(reader, ctx.ownerId, [page, later]);
      expect(rows.map((row) => row.pageId)).toEqual([page.pageId]);
      expect(rows[0]?.due.flashcard).toBe(1);
      expect(rows[0]?.earliestDueAt).toEqual(NOW);
    });

    it("orders pages by their earliest due item, oldest first", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const recent = await ctx.newPage();
      const oldest = await ctx.newPage();
      const middle = await ctx.newPage();
      await ctx.addItem(recent, { dueAt: hoursFromNow(-1) });
      await ctx.addItem(oldest, { dueAt: hoursFromNow(-30) });
      await ctx.addItem(oldest, { dueAt: hoursFromNow(0) });
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
  });
}
