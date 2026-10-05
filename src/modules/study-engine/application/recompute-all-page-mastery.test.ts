import { describe, expect, it, vi } from "vitest";
import type { Clock } from "@/shared/kernel/clock";
import { computeMastery } from "../domain/mastery";
import { newStudyItem, type StudyItem } from "../domain/study-item";
import { recomputeAllPageMastery } from "./recompute-all-page-mastery";
import { InMemoryStudiedPageReader } from "./testing/in-memory-studied-page-reader";
import { InMemoryStudyUnitOfWork } from "./testing/in-memory-study-unit-of-work";

const CREATED = new Date("2026-10-01T08:00:00.000Z");
const NOW = new Date("2026-10-04T06:30:00.000Z");
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const NO_LIMIT = 3_600_000;

let nextItem = 0;
function item(
  ownerId: string,
  pageId: string,
  overrides: Partial<StudyItem> = {},
): StudyItem {
  nextItem += 1;
  return {
    ...newStudyItem({
      id: `item-${nextItem}`,
      ownerId,
      pageId,
      kind: "flashcard",
      sourceId: `source-${nextItem}`,
      now: CREATED,
    }),
    ...overrides,
  };
}

// A clock the test moves by hand.
function manualClock(start: Date) {
  let current = start;
  const clock: Clock = { now: () => current };
  return {
    clock,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

async function setup(
  items: StudyItem[],
  options: { batchSize?: number; timeBudgetMs?: number; clock?: Clock } = {},
) {
  const uow = new InMemoryStudyUnitOfWork();
  for (const it of items) await uow.studyItems.save(it);
  const pages = new InMemoryStudiedPageReader(uow.studyItems, uow.pageMastery);
  let n = 0;
  const onPageError = vi.fn();
  const deps = {
    pages,
    uow,
    clock: options.clock ?? manualClock(NOW).clock,
    ids: { next: () => `mastery-${++n}` },
    timeBudgetMs: options.timeBudgetMs ?? NO_LIMIT,
    onPageError,
    ...(options.batchSize === undefined
      ? {}
      : { batchSize: options.batchSize }),
  };
  return { deps, uow, pages, pageMastery: uow.pageMastery, onPageError };
}

// The pages in the order the job wrote their mastery.
function recordWrites(uow: InMemoryStudyUnitOfWork): string[] {
  const written: string[] = [];
  const upsert = uow.pageMastery.upsert.bind(uow.pageMastery);
  vi.spyOn(uow.pageMastery, "upsert").mockImplementation(async (mastery) => {
    written.push(mastery.pageId);
    return upsert(mastery);
  });
  return written;
}

describe("recomputeAllPageMastery", () => {
  it("does nothing on an empty database and reports a complete run", async () => {
    const { deps, pageMastery } = await setup([]);

    const summary = await recomputeAllPageMastery(deps);

    expect(summary).toEqual({
      pagesRecomputed: 0,
      pagesFailed: 0,
      complete: true,
    });
    expect(await pageMastery.listByOwner("owner-a")).toEqual([]);
  });

  it("recomputes the pages of every owner with computeMastery at the clock's now", async () => {
    const a1 = [
      item("owner-a", "page-a1", {
        intervalDays: 6,
        lastQuality: 4,
        dueAt: new Date(NOW.getTime() - DAY_MS),
      }),
      item("owner-a", "page-a1", {
        intervalDays: 21,
        lastQuality: 5,
        dueAt: new Date(NOW.getTime() + 10 * DAY_MS),
      }),
    ];
    const b1 = [
      item("owner-b", "page-b1", { dueAt: NOW }),
      item("owner-b", "page-b1", {
        intervalDays: 1,
        lastQuality: 1,
        dueAt: new Date(NOW.getTime() + 1),
      }),
    ];
    const { deps, pageMastery } = await setup([...a1, ...b1]);

    const summary = await recomputeAllPageMastery(deps);

    expect(summary).toEqual({
      pagesRecomputed: 2,
      pagesFailed: 0,
      complete: true,
    });
    expect(await pageMastery.getByPage("page-a1", "owner-a")).toEqual({
      id: expect.any(String),
      ownerId: "owner-a",
      pageId: "page-a1",
      ...computeMastery(a1, NOW),
      computedAt: NOW,
    });
    const b = await pageMastery.getByPage("page-b1", "owner-b");
    expect(b).toMatchObject({ ...computeMastery(b1, NOW), computedAt: NOW });
    // dueAt == now is due; one millisecond later is not.
    expect(b?.itemsDue).toBe(1);
  });

  it("excludes suspended items exactly as the per-review recompute does", async () => {
    const active = item("owner-a", "page-1", {
      intervalDays: 21,
      lastQuality: 5,
      dueAt: new Date(NOW.getTime() + DAY_MS),
    });
    const suspended = item("owner-a", "page-1", {
      dueAt: CREATED,
      suspendedAt: CREATED,
    });
    const onlySuspended = item("owner-a", "page-2", {
      dueAt: CREATED,
      suspendedAt: CREATED,
    });
    const { deps, pageMastery } = await setup([
      active,
      suspended,
      onlySuspended,
    ]);

    await recomputeAllPageMastery(deps);

    expect(await pageMastery.getByPage("page-1", "owner-a")).toMatchObject({
      level: "Dominado",
      score: 1,
      itemsTotal: 1,
      itemsDue: 0,
    });
    expect(await pageMastery.getByPage("page-2", "owner-a")).toMatchObject({
      level: "Nuevo",
      score: 0,
      itemsTotal: 0,
      itemsDue: 0,
    });
  });

  it("overwrites a stale row and keeps its id", async () => {
    const { deps, pageMastery } = await setup([
      item("owner-a", "page-1", { dueAt: CREATED }),
    ]);
    await pageMastery.upsert({
      id: "first-id",
      ownerId: "owner-a",
      pageId: "page-1",
      level: "Dominado",
      score: 0.9,
      itemsTotal: 1,
      itemsDue: 0,
      computedAt: CREATED,
    });

    await recomputeAllPageMastery(deps);

    expect(await pageMastery.getByPage("page-1", "owner-a")).toMatchObject({
      id: "first-id",
      itemsDue: 1,
      computedAt: NOW,
    });
  });

  it("reads the pages in bounded batches, each page once, until the listing is exhausted", async () => {
    const items = ["p1", "p2", "p3", "p4", "p5"].map((page) =>
      item("owner-a", page),
    );
    const { deps, uow, pages, pageMastery } = await setup(items, {
      batchSize: 2,
    });
    const listing = vi.spyOn(pages, "listStalePages");
    const written = recordWrites(uow);

    const summary = await recomputeAllPageMastery(deps);

    expect(summary).toEqual({
      pagesRecomputed: 5,
      pagesFailed: 0,
      complete: true,
    });
    expect(written).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(
      listing.mock.calls.map(([query]) => query.after?.pageId ?? null),
    ).toEqual([null, "p2", "p4"]);
    for (const [query] of listing.mock.calls) {
      expect(query.staleBefore).toEqual(NOW);
      expect(query.limit).toBe(2);
    }
    expect(await pageMastery.listByOwner("owner-a")).toHaveLength(5);
  });

  it("never reprocesses a page within a run even when every batch holds one page", async () => {
    // The job's own writes move a page's computedAt to the run start: the
    // listing must not hand the page back in this run.
    const { deps, uow } = await setup(
      ["p1", "p2", "p3"].map((page) => item("owner-a", page)),
      { batchSize: 1 },
    );
    const written = recordWrites(uow);

    const summary = await recomputeAllPageMastery(deps);

    expect(written).toEqual(["p1", "p2", "p3"]);
    expect(summary).toMatchObject({ pagesRecomputed: 3, complete: true });
  });

  it("counts and reports a failing page without stopping the others", async () => {
    const { deps, uow, pageMastery, onPageError } = await setup([
      item("owner-a", "p1"),
      item("owner-a", "p2"),
      item("owner-b", "p3"),
    ]);
    const boom = new Error("connection reset");
    const read = uow.studyItems.listByPage.bind(uow.studyItems);
    vi.spyOn(uow.studyItems, "listByPage").mockImplementation(
      async (pageId, ownerId) => {
        if (pageId === "p2") throw boom;
        return read(pageId, ownerId);
      },
    );

    const summary = await recomputeAllPageMastery(deps);

    expect(summary).toEqual({
      pagesRecomputed: 2,
      pagesFailed: 1,
      complete: true,
    });
    expect(onPageError).toHaveBeenCalledWith(
      { pageId: "p2", ownerId: "owner-a", masteryComputedAt: null },
      boom,
    );
    expect(await pageMastery.getByPage("p1", "owner-a")).not.toBeNull();
    expect(await pageMastery.getByPage("p2", "owner-a")).toBeNull();
    expect(await pageMastery.getByPage("p3", "owner-b")).not.toBeNull();
  });

  it("tries a page that always fails once per run and retries it first on the next run", async () => {
    const { deps, uow, pages } = await setup(
      ["p1", "p2", "p3"].map((page) => item("owner-a", page)),
      { batchSize: 1 },
    );
    const attempts: string[] = [];
    const read = uow.studyItems.listByPage.bind(uow.studyItems);
    vi.spyOn(uow.studyItems, "listByPage").mockImplementation(
      async (pageId, ownerId) => {
        attempts.push(pageId);
        if (pageId === "p2") throw new Error("corrupt row");
        return read(pageId, ownerId);
      },
    );
    const listing = vi.spyOn(pages, "listStalePages");

    const first = await recomputeAllPageMastery(deps);

    expect(first).toEqual({
      pagesRecomputed: 2,
      pagesFailed: 1,
      complete: true,
    });
    expect(attempts).toEqual(["p1", "p2", "p3"]);
    // One listing per page plus the empty one that ends the run.
    expect(listing).toHaveBeenCalledTimes(4);

    attempts.length = 0;
    const later = manualClock(new Date(NOW.getTime() + DAY_MS));
    await recomputeAllPageMastery({ ...deps, clock: later.clock });

    expect(attempts).toEqual(["p2", "p1", "p3"]);
  });

  it("stops between pages once the time budget is spent and reports an incomplete run", async () => {
    const time = manualClock(NOW);
    const { deps, uow, pageMastery } = await setup(
      ["p1", "p2", "p3", "p4", "p5"].map((page) => item("owner-a", page)),
      { clock: time.clock, timeBudgetMs: 150_000 },
    );
    // Each page takes a minute.
    const upsert = uow.pageMastery.upsert.bind(uow.pageMastery);
    vi.spyOn(uow.pageMastery, "upsert").mockImplementation(async (mastery) => {
      await upsert(mastery);
      time.advance(MINUTE_MS);
    });

    const summary = await recomputeAllPageMastery(deps);

    // Started at 0, 60 and 120 s; the fourth would start at 180 s > 150 s.
    expect(summary).toEqual({
      pagesRecomputed: 3,
      pagesFailed: 0,
      complete: false,
    });
    expect(await pageMastery.getByPage("p4", "owner-a")).toBeNull();
    expect(await pageMastery.getByPage("p5", "owner-a")).toBeNull();
  });

  it("starts the next run with the pages the previous run left behind", async () => {
    const time = manualClock(NOW);
    const { deps, uow } = await setup(
      ["p1", "p2", "p3", "p4", "p5"].map((page) => item("owner-a", page)),
      { clock: time.clock, timeBudgetMs: 150_000 },
    );
    const written = recordWrites(uow);
    const upsert = vi.mocked(uow.pageMastery.upsert).getMockImplementation();
    vi.mocked(uow.pageMastery.upsert).mockImplementation(async (mastery) => {
      await upsert?.(mastery);
      time.advance(MINUTE_MS);
    });

    await recomputeAllPageMastery(deps);
    expect(written).toEqual(["p1", "p2", "p3"]);

    written.length = 0;
    time.advance(DAY_MS);
    const next = await recomputeAllPageMastery({
      ...deps,
      timeBudgetMs: NO_LIMIT,
    });

    // Never computed first, then the oldest: nothing starves at the tail.
    expect(written).toEqual(["p4", "p5", "p1", "p2", "p3"]);
    expect(next).toEqual({
      pagesRecomputed: 5,
      pagesFailed: 0,
      complete: true,
    });
  });

  it("locks the page's items, then reads them, then writes at a fresh now, in one unit of work per page", async () => {
    const time = manualClock(NOW);
    const { deps, uow, pageMastery } = await setup(
      [item("owner-a", "p1"), item("owner-a", "p2")],
      { clock: time.clock },
    );
    const steps: string[] = [];
    vi.spyOn(uow, "run").mockImplementation(async (work) => {
      steps.push("begin");
      try {
        return await work({
          studyItems: uow.studyItems,
          reviewLogs: uow.reviewLogs,
          pageMastery: uow.pageMastery,
          sessions: uow.sessions,
        });
      } finally {
        steps.push("end");
      }
    });
    const lockPage = uow.studyItems.lockPage.bind(uow.studyItems);
    vi.spyOn(uow.studyItems, "lockPage").mockImplementation(
      async (pageId, ownerId) => {
        steps.push(`lock ${pageId}`);
        // Time passes while the job waits for the lock.
        time.advance(MINUTE_MS);
        return lockPage(pageId, ownerId);
      },
    );
    const read = uow.studyItems.listByPage.bind(uow.studyItems);
    vi.spyOn(uow.studyItems, "listByPage").mockImplementation(
      async (pageId, ownerId) => {
        steps.push(`read ${pageId}`);
        return read(pageId, ownerId);
      },
    );
    const upsert = uow.pageMastery.upsert.bind(uow.pageMastery);
    vi.spyOn(uow.pageMastery, "upsert").mockImplementation(async (mastery) => {
      steps.push(`write ${mastery.pageId}`);
      return upsert(mastery);
    });

    await recomputeAllPageMastery(deps);

    expect(steps).toEqual([
      "begin",
      "lock p1",
      "read p1",
      "write p1",
      "end",
      "begin",
      "lock p2",
      "read p2",
      "write p2",
      "end",
    ]);
    // Each page is stamped with the time it was computed, not the run start.
    expect((await pageMastery.getByPage("p1", "owner-a"))?.computedAt).toEqual(
      new Date(NOW.getTime() + MINUTE_MS),
    );
    expect((await pageMastery.getByPage("p2", "owner-a"))?.computedAt).toEqual(
      new Date(NOW.getTime() + 2 * MINUTE_MS),
    );
  });

  it("never replaces a grade that commits while the job waits for the page lock", async () => {
    // Interleaving: the job lists the page, a grade holds the item lock and
    // commits the graded card and a fresher mastery, then the job gets the
    // lock. The job must compute from the graded card, not from what it
    // would have read before the grade.
    const time = manualClock(NOW);
    const due = item("owner-a", "p1", { dueAt: CREATED });
    const { deps, uow, pageMastery } = await setup([due], {
      clock: time.clock,
    });
    const lockPage = uow.studyItems.lockPage.bind(uow.studyItems);
    vi.spyOn(uow.studyItems, "lockPage").mockImplementationOnce(
      async (pageId, ownerId) => {
        time.advance(1_000);
        const graded: StudyItem = {
          ...due,
          intervalDays: 6,
          repetitions: 1,
          lastQuality: 5,
          dueAt: new Date(time.clock.now().getTime() + 6 * DAY_MS),
          updatedAt: time.clock.now(),
        };
        await uow.studyItems.save(graded);
        await uow.pageMastery.upsert({
          id: "graded-mastery",
          ownerId: "owner-a",
          pageId: "p1",
          ...computeMastery([graded], time.clock.now()),
          computedAt: time.clock.now(),
        });
        time.advance(1_000);
        return lockPage(pageId, ownerId);
      },
    );

    await recomputeAllPageMastery(deps);

    const stored = await pageMastery.getByPage("p1", "owner-a");
    expect(stored?.itemsDue).toBe(0);
    expect(stored?.computedAt).toEqual(new Date(NOW.getTime() + 2_000));
  });
});
