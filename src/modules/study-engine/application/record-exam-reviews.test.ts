import { describe, expect, it } from "vitest";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import type { PageMastery } from "../domain/page-mastery";
import {
  EXAM_REVIEW_QUALITY,
  newStudyItem,
  type StudyItem,
} from "../domain/study-item";
import { recordExamReviews } from "./record-exam-reviews";
import { InMemoryPageMasteryRepository } from "./testing/in-memory-page-mastery-repository";
import { InMemoryStudyItemRepository } from "./testing/in-memory-study-item-repository";
import { InMemoryStudyUnitOfWork } from "./testing/in-memory-study-unit-of-work";

const OWNER = "owner-1";
const PAGE = "page-1";
const SESSION = "exam-session-1";
const CREATED = new Date("2026-10-04T08:00:00.000Z");
const NOW = new Date("2026-10-05T09:00:00.000Z");
const DAY_MS = 86_400_000;
// The owner's local day (UTC here) ends at midnight: reviews are due per
// day, so an item due before it was due when the exam finished.
const TOMORROW = new Date("2026-10-06T00:00:00.000Z");

// The study item of a root exam question, due at CREATED unless overridden.
function rootItem(rootId: string, overrides: Partial<StudyItem> = {}) {
  return {
    ...newStudyItem({
      id: `item-${rootId}`,
      ownerId: OWNER,
      pageId: PAGE,
      kind: "exam_question",
      sourceId: rootId,
      now: CREATED,
    }),
    ...overrides,
  };
}

// A reviewed item not due until tomorrow.
const notDue = {
  intervalDays: 6,
  repetitions: 2,
  dueAt: new Date(NOW.getTime() + DAY_MS),
};

// Records lock order and counts mastery upserts.
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

class CountingMastery extends InMemoryPageMasteryRepository {
  upserts = 0;
  override async upsert(mastery: PageMastery) {
    this.upserts += 1;
    return super.upsert(mastery);
  }
}

async function setup(items: StudyItem[]) {
  const uow = new InMemoryStudyUnitOfWork(
    new RecordingStudyItems(),
    undefined,
    new CountingMastery(),
  );
  for (const item of items) await uow.studyItems.save(item);
  let n = 0;
  const deps = { uow, ids: { next: () => `id-${++n}` } };
  return {
    uow,
    deps,
    items: uow.studyItems as RecordingStudyItems,
    mastery: uow.pageMastery as CountingMastery,
  };
}

function input(answers: { rootId: string; correct: boolean }[]) {
  return {
    ownerId: OWNER,
    sessionId: SESSION,
    pageId: PAGE,
    answers,
    now: NOW,
    dueBefore: TOMORROW,
  };
}

describe("recordExamReviews", () => {
  it("records a wrong answer with q = 1 even when the item is not due", async () => {
    const { uow, deps } = await setup([rootItem("r1", notDue)]);

    const result = await recordExamReviews(
      input([{ rootId: "r1", correct: false }]),
      deps,
    );

    expect(result.ok).toBe(true);
    const item = await uow.studyItems.findById("item-r1", OWNER);
    expect(item).toMatchObject({
      lastQuality: EXAM_REVIEW_QUALITY.wrong,
      repetitions: 0,
      intervalDays: 1,
      lapses: 1,
      dueAt: new Date(NOW.getTime() + DAY_MS),
      updatedAt: NOW,
    });
    expect(await uow.reviewLogs.listByItem("item-r1", OWNER)).toEqual([
      {
        id: expect.any(String),
        ownerId: OWNER,
        itemId: "item-r1",
        quality: 1,
        reviewedAt: NOW,
        intervalBefore: 6,
        intervalAfter: 1,
        easinessAfter: item?.easiness,
        sessionKind: "exam",
        sessionId: SESSION,
      },
    ]);
  });

  it("records a correct answer to a due item with q = 4", async () => {
    const { uow, deps } = await setup([rootItem("r1")]);

    const result = await recordExamReviews(
      input([{ rootId: "r1", correct: true }]),
      deps,
    );

    expect(result.ok && result.value.reviewedRootIds).toEqual(["r1"]);
    expect(await uow.studyItems.findById("item-r1", OWNER)).toMatchObject({
      lastQuality: EXAM_REVIEW_QUALITY.correct,
      repetitions: 1,
      intervalDays: 1,
    });
    const logs = await uow.reviewLogs.listBySession("exam", SESSION, OWNER);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ quality: 4, sessionKind: "exam" });
  });

  it("treats an item due later today as due: the whole local day is review time", async () => {
    const { uow, deps } = await setup([
      rootItem("r1", { dueAt: new Date(TOMORROW.getTime() - 1) }),
    ]);

    await recordExamReviews(input([{ rootId: "r1", correct: true }]), deps);

    expect(await uow.studyItems.findById("item-r1", OWNER)).toMatchObject({
      lastQuality: 4,
    });
  });

  it("skips a correct answer to an item due at the start of tomorrow", async () => {
    const { deps } = await setup([rootItem("r1", { dueAt: TOMORROW })]);

    const result = await recordExamReviews(
      input([{ rootId: "r1", correct: true }]),
      deps,
    );

    expect(result.ok && result.value.skippedRootIds).toEqual(["r1"]);
  });

  it("skips a correct answer to an item that is not due: no SM-2 change, no log", async () => {
    const stored = rootItem("r1", notDue);
    const { uow, deps } = await setup([stored]);

    const result = await recordExamReviews(
      input([{ rootId: "r1", correct: true }]),
      deps,
    );

    expect(result.ok && result.value).toMatchObject({
      reviewedRootIds: [],
      skippedRootIds: ["r1"],
    });
    expect(await uow.studyItems.findById("item-r1", OWNER)).toEqual(stored);
    expect(await uow.reviewLogs.listByItem("item-r1", OWNER)).toEqual([]);
  });

  it("skips a suspended item, wrong answers included", async () => {
    const stored = rootItem("r1", { suspendedAt: CREATED });
    const { uow, deps } = await setup([stored]);

    const result = await recordExamReviews(
      input([{ rootId: "r1", correct: false }]),
      deps,
    );

    expect(result.ok && result.value.skippedRootIds).toEqual(["r1"]);
    expect(await uow.studyItems.findById("item-r1", OWNER)).toEqual(stored);
    expect(await uow.reviewLogs.listByItem("item-r1", OWNER)).toEqual([]);
  });

  it("refuses a root without a study item and writes nothing", async () => {
    const { uow, deps, mastery } = await setup([rootItem("r1")]);

    const result = await recordExamReviews(
      input([
        { rootId: "r1", correct: false },
        { rootId: "missing", correct: false },
      ]),
      deps,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.ITEM_NOT_FOUND,
    );
    expect(await uow.reviewLogs.listByItem("item-r1", OWNER)).toEqual([]);
    expect(await uow.studyItems.findById("item-r1", OWNER)).toEqual(
      rootItem("r1"),
    );
    expect(mastery.upserts).toBe(0);
  });

  it("refuses another owner's item, another page's item and a non-exam item", async () => {
    const { deps } = await setup([
      rootItem("theirs", { ownerId: "owner-2" }),
      rootItem("elsewhere", { pageId: "page-2" }),
      rootItem("card", { kind: "flashcard" }),
    ]);

    for (const rootId of ["theirs", "elsewhere", "card"]) {
      const result = await recordExamReviews(
        input([{ rootId, correct: false }]),
        deps,
      );
      expect(!result.ok && result.error.code).toBe(
        STUDY_ENGINE_ERROR.ITEM_NOT_FOUND,
      );
    }
  });

  it("refuses two answers to one root", async () => {
    const { uow, deps } = await setup([rootItem("r1")]);

    const result = await recordExamReviews(
      input([
        { rootId: "r1", correct: true },
        { rootId: "r1", correct: false },
      ]),
      deps,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.INVALID_REVIEW_BATCH,
    );
    expect(await uow.reviewLogs.listByItem("item-r1", OWNER)).toEqual([]);
  });

  it("locks the items in id order before reading them, in one unit of work", async () => {
    const { uow, deps, items } = await setup([
      rootItem("r3"),
      rootItem("r1"),
      rootItem("r2"),
    ]);
    items.calls = [];

    await recordExamReviews(
      input([
        { rootId: "r3", correct: false },
        { rootId: "r1", correct: true },
        { rootId: "r2", correct: false },
      ]),
      deps,
    );

    expect(uow.runs).toBe(1);
    const locks = items.calls.filter((call) => call.startsWith("lock:"));
    expect(locks).toEqual(["lock:item-r1", "lock:item-r2", "lock:item-r3"]);
    const lastLock = items.calls.lastIndexOf("lock:item-r3");
    expect(items.calls.indexOf("find:item-r1")).toBeGreaterThan(lastLock);
  });

  it("recomputes the page mastery once for the whole exam", async () => {
    const { uow, deps, mastery } = await setup([
      rootItem("r1"),
      rootItem("r2"),
      rootItem("r3", notDue),
    ]);

    const result = await recordExamReviews(
      input([
        { rootId: "r1", correct: false },
        { rootId: "r2", correct: true },
        { rootId: "r3", correct: true },
      ]),
      deps,
    );

    expect(mastery.upserts).toBe(1);
    const stored = await uow.pageMastery.getByPage(PAGE, OWNER);
    expect(stored).toMatchObject({
      ownerId: OWNER,
      pageId: PAGE,
      itemsTotal: 3,
      itemsDue: 0,
      computedAt: NOW,
    });
    expect(result.ok && result.value).toMatchObject({
      reviewedRootIds: ["r1", "r2"],
      skippedRootIds: ["r3"],
      mastery: stored,
    });
  });

  it("recomputes the mastery even when every answer is skipped", async () => {
    const { deps, mastery } = await setup([rootItem("r1", notDue)]);

    await recordExamReviews(input([{ rootId: "r1", correct: true }]), deps);

    expect(mastery.upserts).toBe(1);
  });
});

describe("recordExamReviews idempotency", () => {
  it("refuses a session that already has exam review logs and writes nothing", async () => {
    const { uow, deps, mastery } = await setup([
      rootItem("r1", notDue),
      rootItem("r2", notDue),
    ]);
    const first = await recordExamReviews(
      input([{ rootId: "r1", correct: false }]),
      deps,
    );
    expect(first.ok).toBe(true);
    const r2Before = await uow.studyItems.findById("item-r2", OWNER);
    const upsertsBefore = mastery.upserts;

    const again = await recordExamReviews(
      input([{ rootId: "r2", correct: false }]),
      deps,
    );

    expect(!again.ok && again.error.code).toBe(
      STUDY_ENGINE_ERROR.EXAM_SESSION_ALREADY_RECORDED,
    );
    expect(await uow.studyItems.findById("item-r2", OWNER)).toEqual(r2Before);
    expect(
      await uow.reviewLogs.listBySession("exam", SESSION, OWNER),
    ).toHaveLength(1);
    expect(mastery.upserts).toBe(upsertsBefore);
  });

  it("checks the session inside the unit of work", async () => {
    const { uow, deps } = await setup([rootItem("r1")]);
    const seen: string[] = [];
    const listBySession = uow.reviewLogs.listBySession.bind(uow.reviewLogs);
    uow.reviewLogs.listBySession = async (...args) => {
      seen.push(`runs:${uow.runs}`);
      return listBySession(...args);
    };

    await recordExamReviews(input([{ rootId: "r1", correct: true }]), deps);

    expect(seen).toEqual(["runs:1"]);
  });

  it("ignores flashcard logs that share the session id", async () => {
    const { uow, deps } = await setup([rootItem("r1")]);
    await uow.reviewLogs.append({
      id: "flash-log",
      ownerId: OWNER,
      itemId: "item-other",
      quality: 4,
      reviewedAt: CREATED,
      intervalBefore: 0,
      intervalAfter: 1,
      easinessAfter: 2.5,
      sessionKind: "flashcards",
      sessionId: SESSION,
    });

    const result = await recordExamReviews(
      input([{ rootId: "r1", correct: true }]),
      deps,
    );

    expect(result.ok).toBe(true);
  });
});
