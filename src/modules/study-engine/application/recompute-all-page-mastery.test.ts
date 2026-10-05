import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { computeMastery } from "../domain/mastery";
import { newStudyItem, type StudyItem } from "../domain/study-item";
import { recomputeAllPageMastery } from "./recompute-all-page-mastery";
import { InMemoryPageMasteryRepository } from "./testing/in-memory-page-mastery-repository";
import { InMemoryStudyItemRepository } from "./testing/in-memory-study-item-repository";

const CREATED = new Date("2026-10-01T08:00:00.000Z");
const NOW = new Date("2026-10-04T06:30:00.000Z");
const DAY_MS = 86_400_000;

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

async function setup(items: StudyItem[], batchSize?: number) {
  const studyItems = new InMemoryStudyItemRepository();
  for (const it of items) await studyItems.save(it);
  const pageMastery = new InMemoryPageMasteryRepository();
  let n = 0;
  const onPageError = vi.fn();
  const deps = {
    pages: studyItems,
    studyItems,
    pageMastery,
    clock: createFixedClock(NOW),
    ids: { next: () => `mastery-${++n}` },
    onPageError,
    ...(batchSize === undefined ? {} : { batchSize }),
  };
  return { deps, studyItems, pageMastery, onPageError };
}

describe("recomputeAllPageMastery", () => {
  it("does nothing on an empty database", async () => {
    const { deps, pageMastery } = await setup([]);

    const summary = await recomputeAllPageMastery(deps);

    expect(summary).toEqual({ pagesRecomputed: 0, pagesFailed: 0 });
    expect(await pageMastery.listByOwner("owner-a")).toEqual([]);
  });

  it("recomputes the pages of every owner with computeMastery at the injected now", async () => {
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

    expect(summary).toEqual({ pagesRecomputed: 2, pagesFailed: 0 });
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

  it("overwrites an existing row and keeps its id", async () => {
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

  it("reads the pages in bounded batches until the listing is exhausted", async () => {
    const items = ["p1", "p2", "p3", "p4", "p5"].map((page) =>
      item("owner-a", page),
    );
    const { deps, studyItems, pageMastery } = await setup(items, 2);
    const listing = vi.spyOn(studyItems, "listStudiedPages");

    const summary = await recomputeAllPageMastery(deps);

    expect(summary).toEqual({ pagesRecomputed: 5, pagesFailed: 0 });
    expect(listing.mock.calls).toEqual([
      [null, 2],
      ["p2", 2],
      ["p4", 2],
    ]);
    expect(await pageMastery.listByOwner("owner-a")).toHaveLength(5);
  });

  it("counts and reports a failing page without stopping the others", async () => {
    const { deps, studyItems, pageMastery, onPageError } = await setup([
      item("owner-a", "p1"),
      item("owner-a", "p2"),
      item("owner-b", "p3"),
    ]);
    const boom = new Error("connection reset");
    const read = studyItems.listByPage.bind(studyItems);
    vi.spyOn(studyItems, "listByPage").mockImplementation(
      async (pageId, ownerId) => {
        if (pageId === "p2") throw boom;
        return read(pageId, ownerId);
      },
    );

    const summary = await recomputeAllPageMastery(deps);

    expect(summary).toEqual({ pagesRecomputed: 2, pagesFailed: 1 });
    expect(onPageError).toHaveBeenCalledWith(
      { pageId: "p2", ownerId: "owner-a" },
      boom,
    );
    expect(await pageMastery.getByPage("p1", "owner-a")).not.toBeNull();
    expect(await pageMastery.getByPage("p2", "owner-a")).toBeNull();
    expect(await pageMastery.getByPage("p3", "owner-b")).not.toBeNull();
  });
});
