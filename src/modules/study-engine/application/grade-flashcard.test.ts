import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import { newFlashcardSession } from "../domain/flashcard-session";
import {
  FLASHCARD_QUALITY,
  type FlashcardRating,
  newStudyItem,
  type StudyItem,
} from "../domain/study-item";
import { gradeFlashcard } from "./grade-flashcard";
import { InMemoryStudyItemRepository } from "./testing/in-memory-study-item-repository";
import { InMemoryStudyUnitOfWork } from "./testing/in-memory-study-unit-of-work";

const OWNER = "owner-1";
const CREATED = new Date("2026-10-04T08:00:00.000Z");
const NOW = new Date("2026-10-04T09:00:00.000Z");
const DAY_MS = 86_400_000;
// The owner's local day (UTC here) ends at midnight: reviews are due per
// day, so a card due before it can be graded now.
const TOMORROW = new Date("2026-10-05T00:00:00.000Z");

function card(id: string, overrides: Partial<StudyItem> = {}): StudyItem {
  return {
    ...newStudyItem({
      id,
      ownerId: OWNER,
      pageId: "page-1",
      kind: "flashcard",
      sourceId: `card-${id}`,
      now: CREATED,
    }),
    ...overrides,
  };
}

// Records the order of lock and read calls on the item repository.
class RecordingStudyItems extends InMemoryStudyItemRepository {
  calls: string[] = [];
  override async lock(id: string, ownerId: string) {
    this.calls.push(`lock:${id}`);
    return super.lock(id, ownerId);
  }
  override async findById(id: string, ownerId: string) {
    this.calls.push(`find:${id}`);
    return super.findById(id, ownerId);
  }
}

async function setup(sessionPageId: string | null = "page-1") {
  const uow = new InMemoryStudyUnitOfWork(new RecordingStudyItems());
  await uow.sessions.insert(
    newFlashcardSession({
      id: "s1",
      ownerId: OWNER,
      pageId: sessionPageId,
      now: NOW,
    }),
  );
  let n = 0;
  const deps = {
    uow,
    clock: createFixedClock(NOW),
    dueCutoff: (now: Date) =>
      now.getTime() === NOW.getTime() ? TOMORROW : new Date(Number.NaN),
    ids: { next: () => `id-${++n}` },
  };
  return { uow, deps, items: uow.studyItems as RecordingStudyItems };
}

async function nothingWritten(uow: InMemoryStudyUnitOfWork, itemId: string) {
  expect(await uow.reviewLogs.listByItem(itemId, OWNER)).toEqual([]);
  expect(await uow.sessions.findById("s1", OWNER)).toMatchObject({
    reviewedCount: 0,
    againCount: 0,
  });
  expect(await uow.pageMastery.getByPage("page-1", OWNER)).toBe(null);
}

describe("gradeFlashcard", () => {
  it("applies SM-2, logs the answer, counts it and recomputes the page mastery in one unit of work", async () => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a"));
    await uow.studyItems.save(card("b"));

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    const expectedItem = {
      ...card("a"),
      easiness: 2.5,
      intervalDays: 1,
      repetitions: 1,
      dueAt: new Date(NOW.getTime() + DAY_MS),
      lastQuality: 4,
      lastReviewedAt: NOW,
      lapses: 0,
      updatedAt: NOW,
    };
    expect(result.value.item).toEqual(expectedItem);
    expect(await uow.studyItems.findById("a", OWNER)).toEqual(expectedItem);
    expect(await uow.reviewLogs.listByItem("a", OWNER)).toEqual([
      {
        id: "id-1",
        ownerId: OWNER,
        itemId: "a",
        quality: 4,
        reviewedAt: NOW,
        intervalBefore: 0,
        intervalAfter: 1,
        easinessAfter: 2.5,
        sessionKind: "flashcards",
        sessionId: "s1",
      },
    ]);
    expect(result.value.session).toMatchObject({
      id: "s1",
      reviewedCount: 1,
      againCount: 0,
    });
    // §7.3: a = 0.6 * (1/21) + 0.4 * 1, b = 0 → mean ≈ 0.214 → Aprendiendo.
    const mastery = {
      id: "id-2",
      ownerId: OWNER,
      pageId: "page-1",
      level: "Aprendiendo",
      score: (0.6 * (1 / 21) + 0.4) / 2,
      itemsTotal: 2,
      itemsDue: 1,
      computedAt: NOW,
    };
    expect(result.value.mastery).toEqual(mastery);
    expect(await uow.pageMastery.getByPage("page-1", OWNER)).toEqual(mastery);
    expect(uow.runs).toBe(1);
  });

  it.each([
    ["again", 1, 1],
    ["hard", 3, 0],
    ["good", 4, 0],
    ["easy", 5, 0],
  ] as const)("maps %s to quality %i (§7.2)", async (rating, quality, again) => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a"));

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: rating as FlashcardRating },
      deps,
      OWNER,
    );

    if (!result.ok) throw result.error;
    expect(FLASHCARD_QUALITY[rating]).toBe(quality);
    expect(result.value.item.lastQuality).toBe(quality);
    expect(result.value.item.lapses).toBe(again);
    expect(result.value.session.againCount).toBe(again);
  });

  it("locks the item before reading it", async () => {
    const { uow, deps, items } = await setup();
    await uow.studyItems.save(card("a"));

    await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    expect(items.calls.slice(0, 2)).toEqual(["lock:a", "find:a"]);
  });

  it("refuses a suspended (archived) card, writing nothing", async () => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a", { suspendedAt: CREATED }));

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.ITEM_SUSPENDED,
    );
    await nothingWritten(uow, "a");
  });

  it("grades a card due later today: the whole local day is review time", async () => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(
      card("a", { dueAt: new Date(TOMORROW.getTime() - 1) }),
    );

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    expect(await uow.reviewLogs.listByItem("a", OWNER)).toHaveLength(1);
  });

  it("refuses a card due tomorrow, writing nothing", async () => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a", { dueAt: TOMORROW }));

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.ITEM_NOT_DUE,
    );
    await nothingWritten(uow, "a");
  });

  it("refuses a card that is not due yet (a double submit), writing nothing", async () => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a"));
    await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    const second = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "easy" },
      deps,
      OWNER,
    );

    expect(!second.ok && second.error.code).toBe(
      STUDY_ENGINE_ERROR.ITEM_NOT_DUE,
    );
    expect(await uow.reviewLogs.listByItem("a", OWNER)).toHaveLength(1);
    expect((await uow.sessions.findById("s1", OWNER))?.reviewedCount).toBe(1);
  });

  it.each([
    ["another owner's card", { ownerId: "owner-2" }],
    ["a card of another page than the session's", { pageId: "page-2" }],
    ["an item of another technique", { kind: "exam_question" as const }],
  ])("refuses %s as not found, writing nothing", async (_label, overrides) => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a", overrides));

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.ITEM_NOT_FOUND,
    );
    await nothingWritten(uow, "a");
  });

  it("accepts any page's card in a multi-page session", async () => {
    const { uow, deps } = await setup(null);
    await uow.studyItems.save(card("a", { pageId: "page-9" }));

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    expect(result.ok && result.value.mastery.pageId).toBe("page-9");
  });

  it("refuses an unknown or another owner's session", async () => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a"));

    const unknown = await gradeFlashcard(
      { sessionId: "nope", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );
    await uow.studyItems.save({
      ...card("x"),
      ownerId: "owner-2",
      sourceId: "x",
    });
    const foreign = await gradeFlashcard(
      { sessionId: "s1", itemId: "x", rating: "good" },
      deps,
      "owner-2",
    );

    expect(!unknown.ok && unknown.error.code).toBe(
      STUDY_ENGINE_ERROR.SESSION_NOT_FOUND,
    );
    expect(!foreign.ok && foreign.error.code).toBe(
      STUDY_ENGINE_ERROR.SESSION_NOT_FOUND,
    );
    await nothingWritten(uow, "a");
  });

  it("refuses a finished session", async () => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a"));
    await uow.sessions.finish("s1", OWNER, NOW);

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.SESSION_FINISHED,
    );
    expect(await uow.reviewLogs.listByItem("a", OWNER)).toEqual([]);
  });
});

describe("gradeFlashcard atomicity", () => {
  it("rolls back the item and its log when the session disappears after the first write", async () => {
    const { uow, deps } = await setup();
    await uow.studyItems.save(card("a"));
    uow.sessions.recordGrade = async () => null;

    const result = await gradeFlashcard(
      { sessionId: "s1", itemId: "a", rating: "good" },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.SESSION_NOT_FOUND,
    );
    expect(await uow.studyItems.findById("a", OWNER)).toEqual(card("a"));
    expect(await uow.reviewLogs.listByItem("a", OWNER)).toEqual([]);
    expect(await uow.pageMastery.getByPage("page-1", OWNER)).toBe(null);
  });
});
