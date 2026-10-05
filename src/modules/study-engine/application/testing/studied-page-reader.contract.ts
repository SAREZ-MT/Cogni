import { describe, expect, it } from "vitest";
import type {
  StudiedPage,
  StudiedPageReader,
} from "../../domain/studied-page-reader";

export interface StudiedPageReaderContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  // The reader under test and the stores written below share data.
  readonly reader: StudiedPageReader;
  // A fresh page owned by `ownerId` (async: the DB runner inserts a row).
  newPageId(ownerId: string): Promise<string>;
  addItem(input: {
    ownerId: string;
    pageId: string;
    suspended?: boolean;
  }): Promise<void>;
  // Writes the page's PageMastery row with the given computedAt.
  setMastery(input: {
    ownerId: string;
    pageId: string;
    computedAt: Date;
  }): Promise<void>;
}

export interface StudiedPageReaderContractOptions {
  context: () => Promise<StudiedPageReaderContractContext>;
}

// Run start used by every case; mastery rows are placed around it.
const STALE_BEFORE = new Date("2026-10-04T06:30:00.000Z");
const minutesBefore = (minutes: number) =>
  new Date(STALE_BEFORE.getTime() - minutes * 60_000);

function compareKeys(a: StudiedPage, b: StudiedPage): number {
  const at = a.masteryComputedAt?.getTime() ?? 0;
  const bt = b.masteryComputedAt?.getTime() ?? 0;
  if (at !== bt) return at - bt;
  return a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0;
}

// Walks the whole listing in batches of `limit`, passing the last page of a
// batch as the cursor; checks every batch's size and that the keyset
// (masteryComputedAt with missing first, then pageId) strictly increases.
// The DB runner shares the database with other suites, so callers only
// assert on their own pages.
async function walk(
  reader: StudiedPageReader,
  limit: number,
): Promise<StudiedPage[]> {
  const all: StudiedPage[] = [];
  let after: StudiedPage | null = null;
  for (;;) {
    const batch = await reader.listStalePages({
      staleBefore: STALE_BEFORE,
      after,
      limit,
    });
    expect(batch.length).toBeLessThanOrEqual(limit);
    for (const page of batch) {
      if (after !== null) expect(compareKeys(after, page)).toBeLessThan(0);
      after = page;
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
      expect(listed).toContainEqual({
        pageId: mine,
        ownerId: ctx.ownerId,
        masteryComputedAt: null,
      });
      expect(listed).toContainEqual({
        pageId: theirs,
        ownerId: ctx.otherOwnerId,
        masteryComputedAt: null,
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

    it("skips pages whose mastery was computed at or after staleBefore", async () => {
      const ctx = await options.context();
      const stale = await ctx.newPageId(ctx.ownerId);
      const atStart = await ctx.newPageId(ctx.ownerId);
      const fresh = await ctx.newPageId(ctx.ownerId);
      for (const pageId of [stale, atStart, fresh]) {
        await ctx.addItem({ ownerId: ctx.ownerId, pageId });
      }
      await ctx.setMastery({
        ownerId: ctx.ownerId,
        pageId: stale,
        computedAt: new Date(STALE_BEFORE.getTime() - 1),
      });
      await ctx.setMastery({
        ownerId: ctx.ownerId,
        pageId: atStart,
        computedAt: STALE_BEFORE,
      });
      await ctx.setMastery({
        ownerId: ctx.ownerId,
        pageId: fresh,
        computedAt: new Date(STALE_BEFORE.getTime() + 60_000),
      });

      const listed = (await walk(ctx.reader, 50)).filter((page) =>
        [stale, atStart, fresh].includes(page.pageId),
      );

      expect(listed).toEqual([
        {
          pageId: stale,
          ownerId: ctx.ownerId,
          masteryComputedAt: new Date(STALE_BEFORE.getTime() - 1),
        },
      ]);
    });

    it("orders pages without mastery first, then oldest mastery, ties by pageId, across batches", async () => {
      const ctx = await options.context();
      const missing: string[] = [];
      const tied: string[] = [];
      for (let i = 0; i < 2; i++)
        missing.push(await ctx.newPageId(ctx.ownerId));
      for (let i = 0; i < 3; i++) tied.push(await ctx.newPageId(ctx.ownerId));
      const oldest = await ctx.newPageId(ctx.ownerId);
      const newer = await ctx.newPageId(ctx.ownerId);
      const created = [...missing, ...tied, oldest, newer];
      for (const pageId of created) {
        await ctx.addItem({ ownerId: ctx.ownerId, pageId });
      }
      for (const pageId of tied) {
        await ctx.setMastery({
          ownerId: ctx.ownerId,
          pageId,
          computedAt: minutesBefore(30),
        });
      }
      await ctx.setMastery({
        ownerId: ctx.ownerId,
        pageId: oldest,
        computedAt: minutesBefore(60),
      });
      await ctx.setMastery({
        ownerId: ctx.ownerId,
        pageId: newer,
        computedAt: minutesBefore(10),
      });

      // Batches of 2 split the tied group: the keyset must neither skip nor
      // repeat a page whose computedAt equals the cursor's.
      const ids = (await walk(ctx.reader, 2))
        .map((page) => page.pageId)
        .filter((id) => created.includes(id));

      expect(ids).toEqual([
        ...[...missing].sort(),
        oldest,
        ...[...tied].sort(),
        newer,
      ]);
    });

    it("never lists a page whose items belong to more than one owner", async () => {
      const ctx = await options.context();
      const pageId = await ctx.newPageId(ctx.ownerId);
      await ctx.addItem({ ownerId: ctx.ownerId, pageId });
      await ctx.addItem({ ownerId: ctx.otherOwnerId, pageId });

      const ids = (await walk(ctx.reader, 50)).map((page) => page.pageId);

      expect(ids).not.toContain(pageId);
    });

    it("returns nothing after the last possible key", async () => {
      const ctx = await options.context();
      const pageId = await ctx.newPageId(ctx.ownerId);
      await ctx.addItem({ ownerId: ctx.ownerId, pageId });

      expect(
        await ctx.reader.listStalePages({
          staleBefore: STALE_BEFORE,
          after: {
            pageId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
            ownerId: ctx.ownerId,
            masteryComputedAt: new Date(STALE_BEFORE.getTime() - 1),
          },
          limit: 50,
        }),
      ).toEqual([]);
    });
  });
}
