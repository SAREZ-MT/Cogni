import { describe, expect, it } from "vitest";
import { STUDY_ENGINE_ERROR } from "../domain/errors";
import type { PageMastery } from "../domain/page-mastery";
import { newStudyItem, type StudyItem } from "../domain/study-item";
import { recordRecallReviews } from "./record-recall-reviews";
import { InMemoryPageMasteryRepository } from "./testing/in-memory-page-mastery-repository";
import { InMemoryStudyItemRepository } from "./testing/in-memory-study-item-repository";
import { InMemoryStudyUnitOfWork } from "./testing/in-memory-study-unit-of-work";

const OWNER = "owner-1";
const PAGE = "page-1";
const SESSION = "recall-session-1";
const CREATED = new Date("2026-10-05T08:00:00.000Z");
const NOW = new Date("2026-10-06T09:00:00.000Z");
const DAY_MS = 86_400_000;

// The study item of a recall question, due at CREATED unless overridden.
function questionItem(questionId: string, overrides: Partial<StudyItem> = {}) {
  return {
    ...newStudyItem({
      id: `item-${questionId}`,
      ownerId: OWNER,
      pageId: PAGE,
      kind: "recall_question",
      sourceId: questionId,
      now: CREATED,
    }),
    ...overrides,
  };
}

// A reviewed item not due until tomorrow (e.g. already reviewed by an
// earlier evaluation of an overlapping session).
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

function input(
  reviews: { questionId: string; quality: number }[],
  now: Date = NOW,
) {
  return {
    ownerId: OWNER,
    sessionId: SESSION,
    pageId: PAGE,
    reviews,
    now,
  };
}

describe("recordRecallReviews", () => {
  it("applies SM-2 with the combined quality and logs it as a recall review", async () => {
    const { uow, deps } = await setup([questionItem("q1")]);

    const result = await recordRecallReviews(
      input([{ questionId: "q1", quality: 5 }]),
      deps,
    );

    expect(result.ok && result.value.reviewedQuestionIds).toEqual(["q1"]);
    const item = await uow.studyItems.findById("item-q1", OWNER);
    expect(item).toMatchObject({
      lastQuality: 5,
      lastReviewedAt: NOW,
      repetitions: 1,
      intervalDays: 1,
      dueAt: new Date(NOW.getTime() + DAY_MS),
      updatedAt: NOW,
    });
    expect(await uow.reviewLogs.listByItem("item-q1", OWNER)).toEqual([
      {
        id: expect.any(String),
        ownerId: OWNER,
        itemId: "item-q1",
        quality: 5,
        reviewedAt: NOW,
        intervalBefore: 0,
        intervalAfter: 1,
        easinessAfter: item?.easiness,
        sessionKind: "recall",
        sessionId: SESSION,
      },
    ]);
  });

  it("records a failing quality (< 3) as a lapse", async () => {
    const { uow, deps } = await setup([
      questionItem("q1", { repetitions: 3, intervalDays: 15 }),
    ]);

    await recordRecallReviews(input([{ questionId: "q1", quality: 2 }]), deps);

    expect(await uow.studyItems.findById("item-q1", OWNER)).toMatchObject({
      lastQuality: 2,
      repetitions: 0,
      intervalDays: 1,
      lapses: 1,
    });
  });

  it("records a failing quality even when the item is not due", async () => {
    const { uow, deps } = await setup([questionItem("q1", notDue)]);

    const result = await recordRecallReviews(
      input([{ questionId: "q1", quality: 0 }]),
      deps,
    );

    expect(result.ok && result.value.reviewedQuestionIds).toEqual(["q1"]);
    expect(await uow.studyItems.findById("item-q1", OWNER)).toMatchObject({
      lastQuality: 0,
      intervalDays: 1,
      lapses: 1,
    });
  });

  it("skips a passing quality on an item that is not due, so the interval is never inflated", async () => {
    const stored = questionItem("q1", notDue);
    const { uow, deps } = await setup([stored]);

    const result = await recordRecallReviews(
      input([{ questionId: "q1", quality: 5 }]),
      deps,
    );

    expect(result.ok && result.value).toMatchObject({
      reviewedQuestionIds: [],
      skippedQuestionIds: ["q1"],
      alreadyRecordedQuestionIds: [],
    });
    expect(await uow.studyItems.findById("item-q1", OWNER)).toEqual(stored);
    expect(await uow.reviewLogs.listByItem("item-q1", OWNER)).toEqual([]);
  });

  it("treats an item due exactly now as due", async () => {
    const { uow, deps } = await setup([questionItem("q1", { dueAt: NOW })]);

    await recordRecallReviews(input([{ questionId: "q1", quality: 4 }]), deps);

    expect(await uow.studyItems.findById("item-q1", OWNER)).toMatchObject({
      lastQuality: 4,
    });
  });

  it("skips a suspended item, failing qualities included", async () => {
    const stored = questionItem("q1", { suspendedAt: CREATED });
    const { uow, deps } = await setup([stored]);

    const result = await recordRecallReviews(
      input([{ questionId: "q1", quality: 1 }]),
      deps,
    );

    expect(result.ok && result.value.skippedQuestionIds).toEqual(["q1"]);
    expect(await uow.studyItems.findById("item-q1", OWNER)).toEqual(stored);
    expect(await uow.reviewLogs.listByItem("item-q1", OWNER)).toEqual([]);
  });

  it("refuses a quality outside the integers 0–5 before touching anything", async () => {
    for (const quality of [-1, 6, 2.5, Number.NaN]) {
      const { uow, deps, items } = await setup([questionItem("q1")]);
      items.calls = [];

      const result = await recordRecallReviews(
        input([{ questionId: "q1", quality }]),
        deps,
      );

      expect(!result.ok && result.error.code).toBe(
        STUDY_ENGINE_ERROR.INVALID_QUALITY,
      );
      expect(uow.runs).toBe(0);
      expect(items.calls).toEqual([]);
    }
  });

  it("refuses two reviews of one question", async () => {
    const { uow, deps } = await setup([questionItem("q1")]);

    const result = await recordRecallReviews(
      input([
        { questionId: "q1", quality: 4 },
        { questionId: "q1", quality: 2 },
      ]),
      deps,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.INVALID_REVIEW_BATCH,
    );
    expect(uow.runs).toBe(0);
  });

  it("refuses a question without a study item and writes nothing", async () => {
    const { uow, deps, mastery } = await setup([questionItem("q1")]);

    const result = await recordRecallReviews(
      input([
        { questionId: "q1", quality: 1 },
        { questionId: "missing", quality: 1 },
      ]),
      deps,
    );

    expect(!result.ok && result.error.code).toBe(
      STUDY_ENGINE_ERROR.ITEM_NOT_FOUND,
    );
    expect(await uow.reviewLogs.listByItem("item-q1", OWNER)).toEqual([]);
    expect(await uow.studyItems.findById("item-q1", OWNER)).toEqual(
      questionItem("q1"),
    );
    expect(mastery.upserts).toBe(0);
  });

  it("refuses another owner's item, another page's item and a non-recall item", async () => {
    const { deps } = await setup([
      questionItem("theirs", { ownerId: "owner-2" }),
      questionItem("elsewhere", { pageId: "page-2" }),
      questionItem("root", { kind: "exam_question" }),
    ]);

    for (const questionId of ["theirs", "elsewhere", "root"]) {
      const result = await recordRecallReviews(
        input([{ questionId, quality: 1 }]),
        deps,
      );
      expect(!result.ok && result.error.code).toBe(
        STUDY_ENGINE_ERROR.ITEM_NOT_FOUND,
      );
    }
  });

  it("locks the items in id order before reading them, in one unit of work", async () => {
    const { uow, deps, items } = await setup([
      questionItem("q3"),
      questionItem("q1"),
      questionItem("q2"),
    ]);
    items.calls = [];

    await recordRecallReviews(
      input([
        { questionId: "q3", quality: 1 },
        { questionId: "q1", quality: 4 },
        { questionId: "q2", quality: 3 },
      ]),
      deps,
    );

    expect(uow.runs).toBe(1);
    const locks = items.calls.filter((call) => call.startsWith("lock:"));
    expect(locks).toEqual(["lock:item-q1", "lock:item-q2", "lock:item-q3"]);
    const lastLock = items.calls.lastIndexOf("lock:item-q3");
    expect(items.calls.indexOf("find:item-q1")).toBeGreaterThan(lastLock);
  });

  it("recomputes the page mastery once for the whole batch", async () => {
    const { uow, deps, mastery } = await setup([
      questionItem("q1"),
      questionItem("q2"),
      questionItem("q3", notDue),
    ]);

    const result = await recordRecallReviews(
      input([
        { questionId: "q1", quality: 1 },
        { questionId: "q2", quality: 4 },
        { questionId: "q3", quality: 5 },
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
      reviewedQuestionIds: ["q1", "q2"],
      skippedQuestionIds: ["q3"],
      mastery: stored,
    });
  });

  it("recomputes the mastery even when every review is skipped", async () => {
    const { deps, mastery } = await setup([questionItem("q1", notDue)]);

    await recordRecallReviews(input([{ questionId: "q1", quality: 4 }]), deps);

    expect(mastery.upserts).toBe(1);
  });
});

// Recall answers are evaluated incrementally: a finish records the answers
// evaluated now, a later "Reintentar" records the ones that failed before.
// So the guard is per (session, item), not per session: an answer already
// recorded in this session is reported back and left alone, while the
// session's other answers still record.
describe("recordRecallReviews idempotency per (session, item)", () => {
  it("records the remaining answers of a session that already recorded others", async () => {
    const { uow, deps } = await setup([questionItem("q1"), questionItem("q2")]);
    const first = await recordRecallReviews(
      input([{ questionId: "q1", quality: 4 }]),
      deps,
    );
    expect(first.ok).toBe(true);

    const retry = await recordRecallReviews(
      input(
        [{ questionId: "q2", quality: 3 }],
        new Date(NOW.getTime() + 60_000),
      ),
      deps,
    );

    expect(retry.ok && retry.value.reviewedQuestionIds).toEqual(["q2"]);
    expect(
      (await uow.reviewLogs.listBySession("recall", SESSION, OWNER)).map(
        (log) => log.itemId,
      ),
    ).toEqual(["item-q1", "item-q2"]);
  });

  it("never records an already recorded (session, item) twice", async () => {
    const { uow, deps, mastery } = await setup([
      questionItem("q1"),
      questionItem("q2"),
    ]);
    await recordRecallReviews(input([{ questionId: "q1", quality: 1 }]), deps);
    const q1Before = await uow.studyItems.findById("item-q1", OWNER);
    const upsertsBefore = mastery.upserts;

    // After the q = 1 lapse q1 is due tomorrow, but a failing quality
    // reviews a not-due item too, so only the guard stops this replay.
    const again = await recordRecallReviews(
      input([
        { questionId: "q1", quality: 0 },
        { questionId: "q2", quality: 4 },
      ]),
      deps,
    );

    expect(again.ok && again.value).toMatchObject({
      reviewedQuestionIds: ["q2"],
      skippedQuestionIds: [],
      alreadyRecordedQuestionIds: ["q1"],
    });
    expect(await uow.studyItems.findById("item-q1", OWNER)).toEqual(q1Before);
    expect(await uow.reviewLogs.listByItem("item-q1", OWNER)).toHaveLength(1);
    expect(mastery.upserts).toBe(upsertsBefore + 1);
  });

  it("does not count another session's or another technique's log as recorded", async () => {
    const { uow, deps } = await setup([questionItem("q1")]);
    for (const [sessionKind, sessionId] of [
      ["recall", "other-recall-session"],
      ["exam", SESSION],
    ] as const) {
      await uow.reviewLogs.append({
        id: `log-${sessionKind}`,
        ownerId: OWNER,
        itemId: "item-q1",
        quality: 1,
        reviewedAt: CREATED,
        intervalBefore: 0,
        intervalAfter: 1,
        easinessAfter: 2.5,
        sessionKind,
        sessionId,
      });
    }

    const result = await recordRecallReviews(
      input([{ questionId: "q1", quality: 4 }]),
      deps,
    );

    expect(result.ok && result.value.reviewedQuestionIds).toEqual(["q1"]);
  });

  it("checks the recorded answers inside the unit of work, after the locks", async () => {
    const { uow, deps, items } = await setup([questionItem("q1")]);
    items.calls = [];
    const listBySession = uow.reviewLogs.listBySession.bind(uow.reviewLogs);
    uow.reviewLogs.listBySession = async (...args) => {
      items.calls.push(`logs:runs=${uow.runs}`);
      return listBySession(...args);
    };

    await recordRecallReviews(input([{ questionId: "q1", quality: 4 }]), deps);

    expect(items.calls).toContain("logs:runs=1");
    expect(items.calls.indexOf("logs:runs=1")).toBeGreaterThan(
      items.calls.indexOf("lock:item-q1"),
    );
  });
});
