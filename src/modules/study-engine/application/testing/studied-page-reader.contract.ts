import { describe, expect, it } from "vitest";
import type {
  StudiedPage,
  StudiedPageReader,
} from "../../domain/studied-page-reader";

export interface StudiedPageReaderContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // The reader under test and the store the items are added to share data.
  readonly reader: StudiedPageReader;
  // A fresh page owned by `ownerId` (async: the DB runner inserts a row).
  newPageId(ownerId: string): Promise<string>;
  addItem(input: {
    ownerId: string;
    pageId: string;
    suspended?: boolean;
  }): Promise<void>;
}

export interface StudiedPageReaderContractOptions {
  context: () => Promise<StudiedPageReaderContractContext>;
}

// Walks the whole listing in batches of `limit`; checks every batch's size
// and the global order. The DB runner shares the database with other suites,
// so callers only assert on their own pages.
async function walk(
  reader: StudiedPageReader,
  limit: number,
): Promise<StudiedPage[]> {
  const all: StudiedPage[] = [];
  let after: string | null = null;
  for (;;) {
    const batch = await reader.listStudiedPages(after, limit);
    expect(batch.length).toBeLessThanOrEqual(limit);
    for (const page of batch) {
      if (after !== null) expect(page.pageId > after).toBe(true);
      after = page.pageId;
      all.push(page);
    }
    if (batch.length < limit) return all;
  }
}

// Shared by the in-memory fake (unit suite) and the Drizzle adapter
// (`pnpm test:db`); both must satisfy it.
export function runStudiedPageReaderContract(
  options: StudiedPageReaderContractOptions,
): void {
  describe("StudiedPageReader contract", () => {
    it("lists every owner's studied pages once each with their owner", async () => {
      const ctx = await options.context();
      const mine = await ctx.newPageId(ctx.ownerId);
      const theirs = await ctx.newPageId(ctx.otherOwnerId);
      await ctx.addItem({ ownerId: ctx.ownerId, pageId: mine });
      await ctx.addItem({ ownerId: ctx.ownerId, pageId: mine });
      await ctx.addItem({ ownerId: ctx.otherOwnerId, pageId: theirs });

      const listed = (await walk(ctx.reader, 50)).filter(
        (page) => page.pageId === mine || page.pageId === theirs,
      );

      expect(listed).toHaveLength(2);
      expect(listed).toContainEqual({ pageId: mine, ownerId: ctx.ownerId });
      expect(listed).toContainEqual({
        pageId: theirs,
        ownerId: ctx.otherOwnerId,
      });
    });

    it("lists a page whose only item is suspended and skips pages without items", async () => {
      const ctx = await options.context();
      const suspended = await ctx.newPageId(ctx.ownerId);
      const empty = await ctx.newPageId(ctx.ownerId);
      await ctx.addItem({
        ownerId: ctx.ownerId,
        pageId: suspended,
        suspended: true,
      });

      const ids = (await walk(ctx.reader, 50)).map((page) => page.pageId);

      expect(ids).toContain(suspended);
      expect(ids).not.toContain(empty);
    });

    it("pages through the listing in pageId order without repeating a page", async () => {
      const ctx = await options.context();
      const created: string[] = [];
      for (let i = 0; i < 5; i++) {
        const pageId = await ctx.newPageId(ctx.ownerId);
        await ctx.addItem({ ownerId: ctx.ownerId, pageId });
        created.push(pageId);
      }

      const ids = (await walk(ctx.reader, 2))
        .map((page) => page.pageId)
        .filter((id) => created.includes(id));

      expect(ids).toEqual([...created].sort());
    });

    it("returns nothing after the highest possible pageId", async () => {
      const ctx = await options.context();
      const pageId = await ctx.newPageId(ctx.ownerId);
      await ctx.addItem({ ownerId: ctx.ownerId, pageId });

      expect(
        await ctx.reader.listStudiedPages(
          "ffffffff-ffff-ffff-ffff-ffffffffffff",
          50,
        ),
      ).toEqual([]);
    });
  });
}
