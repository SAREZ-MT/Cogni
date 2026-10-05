import { describe, expect, it } from "vitest";
import type { Clock } from "@/shared/kernel/clock";
import { ok } from "@/shared/kernel/result";
import { newStudyItem } from "../domain/study-item";
import { finishFlashcardSession } from "./finish-flashcard-session";
import { gradeFlashcard } from "./grade-flashcard";
import { startFlashcardSession } from "./start-flashcard-session";
import { InMemoryStudyUnitOfWork } from "./testing/in-memory-study-unit-of-work";

// End to end through the three use cases with an injected clock: a student
// reviews one page's deck over 3 simulated days (and card A's third review
// on day 7, when it is next due), and every interval, EF and due date is
// exactly SM-2 (§7.1) with the §7.2 button mapping. Same numbers as the
// 3-day table in domain/sm2.test.ts.

const OWNER = "owner-1";
const PAGE = "page-1";
const T0 = new Date("2026-01-01T00:00:00.000Z");
const DAY_MS = 86_400_000;
const day = (n: number) => new Date(T0.getTime() + n * DAY_MS);

class SettableClock implements Clock {
  current = T0;
  now() {
    return this.current;
  }
}

function harness() {
  const uow = new InMemoryStudyUnitOfWork();
  const clock = new SettableClock();
  let n = 0;
  const ids = { next: () => `id-${String(++n).padStart(3, "0")}` };
  const pages = { getPageText: async () => ok({}) };

  async function review(
    on: number,
    answers: Record<string, "again" | "hard" | "good" | "easy">,
  ) {
    clock.current = day(on);
    const started = await startFlashcardSession(
      { pageId: PAGE },
      { pages, studyItems: uow.studyItems, sessions: uow.sessions, clock, ids },
      OWNER,
    );
    if (!started.ok) throw started.error;
    const dueIds = started.value.items.map((item) => item.itemId);
    for (const itemId of dueIds) {
      const rating = answers[itemId];
      if (!rating) throw new Error(`no answer for due item ${itemId}`);
      const graded = await gradeFlashcard(
        { sessionId: started.value.session.id, itemId, rating },
        { uow, clock, ids },
        OWNER,
      );
      if (!graded.ok) throw graded.error;
    }
    const finished = await finishFlashcardSession(
      { sessionId: started.value.session.id },
      { sessions: uow.sessions, clock },
      OWNER,
    );
    if (!finished.ok) throw finished.error;
    return { dueIds, summary: finished.value };
  }

  async function state(itemId: string) {
    const item = await uow.studyItems.findById(itemId, OWNER);
    if (!item) throw new Error(`missing item ${itemId}`);
    return item;
  }

  return { uow, review, state };
}

describe("flashcard review over 3 simulated days", () => {
  it("schedules every answer exactly as SM-2 and persists logs, counts and mastery", async () => {
    const { uow, review, state } = harness();
    for (const id of ["a", "b"]) {
      await uow.studyItems.save(
        newStudyItem({
          id,
          ownerId: OWNER,
          pageId: PAGE,
          kind: "flashcard",
          sourceId: `card-${id}`,
          now: T0,
        }),
      );
    }

    // Day 0: both new cards are due. A: Bien (4). B: Otra vez (1).
    const day0 = await review(0, { a: "good", b: "again" });
    expect(day0.dueIds).toEqual(["a", "b"]);
    expect(day0.summary).toMatchObject({ reviewedCount: 2, againCount: 1 });
    expect(await state("a")).toMatchObject({
      intervalDays: 1,
      repetitions: 1,
      easiness: 2.5,
      dueAt: day(1),
    });
    const b0 = await state("b");
    expect(b0).toMatchObject({
      intervalDays: 1,
      repetitions: 0,
      lapses: 1,
      dueAt: day(1),
    });
    expect(b0.easiness).toBeCloseTo(1.96, 10); // 2.5 - 0.54

    // Day 1: both due again. A: Fácil (5) → I = 6. B: Bien (4) → I = 1.
    const day1 = await review(1, { a: "easy", b: "good" });
    expect(day1.dueIds).toEqual(["a", "b"]);
    expect(day1.summary).toMatchObject({ reviewedCount: 2, againCount: 0 });
    const a1 = await state("a");
    expect(a1).toMatchObject({
      intervalDays: 6,
      repetitions: 2,
      dueAt: day(7),
    });
    expect(a1.easiness).toBeCloseTo(2.6, 10);
    expect(await state("b")).toMatchObject({
      intervalDays: 1,
      repetitions: 1,
      dueAt: day(2),
    });

    // Day 2: only B is due (A waits until day 7). B: Bien (4) → I = 6.
    const day2 = await review(2, { b: "good" });
    expect(day2.dueIds).toEqual(["b"]);
    expect(await state("b")).toMatchObject({
      intervalDays: 6,
      repetitions: 2,
      dueAt: day(8),
    });

    // Day 7: A's third review. Difícil (3) → I = round(6 * 2.6) = 16.
    const day7 = await review(7, { a: "hard" });
    expect(day7.dueIds).toEqual(["a"]);
    const a7 = await state("a");
    expect(a7).toMatchObject({
      intervalDays: 16,
      repetitions: 3,
      lapses: 0,
      dueAt: day(23),
    });
    expect(a7.easiness).toBeCloseTo(2.46, 10);

    // One log per answer, in order, with the intervals before and after.
    const logsA = await uow.reviewLogs.listByItem("a", OWNER);
    expect(
      logsA.map((log) => [log.quality, log.intervalBefore, log.intervalAfter]),
    ).toEqual([
      [4, 0, 1],
      [5, 1, 6],
      [3, 6, 16],
    ]);
    const logsB = await uow.reviewLogs.listByItem("b", OWNER);
    expect(
      logsB.map((log) => [log.quality, log.intervalBefore, log.intervalAfter]),
    ).toEqual([
      [1, 0, 1],
      [4, 1, 1],
      [4, 1, 6],
    ]);

    // Mastery after day 7 (§7.3): A 0.6·16/21 + 0.4, B 0.6·6/21 + 0.4.
    const mastery = await uow.pageMastery.getByPage(PAGE, OWNER);
    const score = (0.6 * (16 / 21) + 0.4 + (0.6 * (6 / 21) + 0.4)) / 2;
    expect(mastery?.score).toBeCloseTo(score, 10);
    expect(mastery).toMatchObject({
      level: "Dominado",
      itemsTotal: 2,
      itemsDue: 0,
      computedAt: day(7),
    });
  });
});
