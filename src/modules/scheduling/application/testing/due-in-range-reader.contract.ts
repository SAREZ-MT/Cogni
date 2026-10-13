import { describe, expect, it } from "vitest";
import type { CalendarItem } from "../../domain/calendar";
import type { DueInRangeReader } from "../../domain/due-in-range-reader";
import type {
  DuePageFixture,
  DueTodayReaderContractContext,
} from "./due-today-reader.contract";

export interface DueInRangeReaderContractOptions {
  createReader(): DueInRangeReader;
  // Same fixtures as the "Hoy" reader contract: both read study_items
  // joined to their page and notebook.
  context: () => DueTodayReaderContractContext;
}

const FROM = new Date("2026-10-19T00:00:00.000Z");
const TO = new Date("2026-10-26T00:00:00.000Z");
const DAY_MS = 86_400_000;
const daysFromStart = (days: number) =>
  new Date(FROM.getTime() + days * DAY_MS);

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it. The DB owner may hold rows from
// other tests, so every assertion looks only at the test's own pages.
export function runDueInRangeReaderContract(
  options: DueInRangeReaderContractOptions,
): void {
  const listFor = async (
    reader: DueInRangeReader,
    ownerId: string,
    pages: readonly DuePageFixture[],
  ): Promise<CalendarItem[]> => {
    const ids = new Set(pages.map((page) => page.pageId));
    return (await reader.listDueInRange(ownerId, FROM, TO)).filter((row) =>
      ids.has(row.pageId),
    );
  };

  describe("DueInRangeReader contract", () => {
    it("describes each item in the range with its page, notebook and kind", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      await ctx.addItem(page, { dueAt: daysFromStart(2) });
      await ctx.addItem(page, {
        kind: "recall_question",
        dueAt: daysFromStart(1),
      });

      expect(await listFor(reader, ctx.ownerId, [page])).toEqual([
        {
          pageId: page.pageId,
          pageTitle: page.pageTitle,
          notebookId: page.notebookId,
          kind: "recall_question",
          dueAt: daysFromStart(1),
        },
        {
          pageId: page.pageId,
          pageTitle: page.pageTitle,
          notebookId: page.notebookId,
          kind: "flashcard",
          dueAt: daysFromStart(2),
        },
      ]);
    });

    it("includes the range start and excludes its end", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      await ctx.addItem(page, { dueAt: new Date(FROM.getTime() - 1) });
      await ctx.addItem(page, { dueAt: FROM });
      await ctx.addItem(page, { dueAt: new Date(TO.getTime() - 1) });
      await ctx.addItem(page, { dueAt: TO });

      expect(
        (await listFor(reader, ctx.ownerId, [page])).map((row) => row.dueAt),
      ).toEqual([FROM, new Date(TO.getTime() - 1)]);
    });

    it("skips suspended items", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const page = await ctx.newPage();
      await ctx.addItem(page, { dueAt: daysFromStart(1), suspended: true });
      await ctx.addItem(page, { dueAt: daysFromStart(2) });

      expect(
        (await listFor(reader, ctx.ownerId, [page])).map((row) => row.dueAt),
      ).toEqual([daysFromStart(2)]);
    });

    it("leaves out archived pages and pages of archived notebooks", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const active = await ctx.newPage();
      const archivedPage = await ctx.newPage();
      const archivedNotebook = await ctx.newPage();
      for (const page of [active, archivedPage, archivedNotebook]) {
        await ctx.addItem(page, { dueAt: daysFromStart(1) });
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

    it("never lists another owner's items", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const mine = await ctx.newPage();
      const theirs = await ctx.newPage(ctx.otherOwnerId);
      await ctx.addItem(mine, { dueAt: daysFromStart(1) });
      await ctx.addItem(theirs, { dueAt: daysFromStart(1) });

      expect(
        (await listFor(reader, ctx.ownerId, [mine, theirs])).map(
          (row) => row.pageId,
        ),
      ).toEqual([mine.pageId]);
    });

    it("orders items by due date, then page id", async () => {
      const ctx = options.context();
      const reader = options.createReader();
      const first = await ctx.newPage();
      const second = await ctx.newPage();
      await ctx.addItem(first, { dueAt: daysFromStart(3) });
      await ctx.addItem(second, { dueAt: daysFromStart(1) });
      await ctx.addItem(first, { dueAt: daysFromStart(1) });

      const rows = await listFor(reader, ctx.ownerId, [first, second]);
      const [low, high] = [first.pageId, second.pageId].sort();
      expect(rows.map((row) => [row.dueAt, row.pageId])).toEqual([
        [daysFromStart(1), low],
        [daysFromStart(1), high],
        [daysFromStart(3), first.pageId],
      ]);
    });
  });
}
