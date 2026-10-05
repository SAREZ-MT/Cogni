import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { EXAM_ERROR } from "../domain/errors";
import { composeSessionQuestions } from "./exam-session-work";
import { startExamSession } from "./start-exam-session";
import {
  LATER,
  NOW,
  OWNER,
  PAGE,
  pages,
  seedSessionQuestions,
} from "./testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./testing/in-memory-exam-session-unit-of-work";

function setup(now: Date = LATER) {
  const uow = new InMemoryExamSessionUnitOfWork();
  let n = 0;
  const deps = {
    pages,
    uow,
    clock: createFixedClock(now),
    ids: { next: () => `session-${++n}` },
  };
  return { uow, deps };
}

describe("startExamSession", () => {
  it("creates an open session of the requested size on the owner's page", async () => {
    const { uow, deps } = setup();
    await seedSessionQuestions(uow, 12);
    const result = await startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resumed).toBe(false);
    expect(result.value.session).toMatchObject({
      id: "session-1",
      pageId: PAGE,
      requestedCount: 10,
      isRetake: false,
      startedAt: LATER,
      finishedAt: null,
    });
    expect(
      await uow.repos.sessions.findById("session-1", OWNER),
    ).not.toBeNull();
  });

  it("refuses another owner's page", async () => {
    const { uow, deps } = setup();
    await seedSessionQuestions(uow, 12);
    const result = await startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      "someone-else",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PAGE_NOT_FOUND");
  });

  it("refuses a count outside 10 to 30", async () => {
    const { uow, deps } = setup();
    await seedSessionQuestions(uow, 12);
    for (const requestedCount of [9, 31]) {
      const result = await startExamSession(
        { pageId: PAGE, requestedCount },
        deps,
        OWNER,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe(EXAM_ERROR.INVALID_QUESTION_COUNT);
    }
  });

  it("refuses a page with fewer than 10 questions and stores nothing", async () => {
    const { uow, deps } = setup();
    await seedSessionQuestions(uow, 9);
    const result = await startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.NOT_ENOUGH_QUESTIONS);
    expect(await uow.repos.sessions.findOpenByPage(PAGE, OWNER)).toBeNull();
  });

  it("refuses while a retake is pending (T7 reformulates the failed questions)", async () => {
    const { uow, deps } = setup();
    await seedSessionQuestions(uow, 12);
    await uow.repos.pageStates.upsert({
      pageId: PAGE,
      ownerId: OWNER,
      retakePending: true,
      failedRootIds: ["q-01"],
      lastPassedSessionId: null,
    });
    const result = await startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(EXAM_ERROR.RETAKE_PENDING);
    expect(await uow.repos.sessions.findOpenByPage(PAGE, OWNER)).toBeNull();
  });

  it("resumes the page's open session instead of creating another", async () => {
    const { uow, deps } = setup();
    await seedSessionQuestions(uow, 12);
    const first = await startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    const again = await startExamSession(
      { pageId: PAGE, requestedCount: 20 },
      deps,
      OWNER,
    );
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.value.resumed).toBe(true);
    expect(again.value.session).toEqual(first.value.session);
    expect(again.value.session.requestedCount).toBe(10);
  });

  it("orders the questions due first, then least recently seen, and keeps that order", async () => {
    const { uow, deps } = setup();
    // q-01..q-12 created at NOW. Items: q-05 due earliest, q-03 due later;
    // the rest not due yet.
    const questions = await seedSessionQuestions(uow, 12, {
      dueAt: new Date("2026-10-20T00:00:00.000Z"),
    });
    const due = new Map([
      ["q-05", NOW],
      ["q-03", new Date("2026-10-05T12:00:00.000Z")],
    ]);
    for (const [n, item] of uow.studyItems.items.entries()) {
      const dueAt = due.get(item.sourceId);
      if (dueAt) uow.studyItems.items[n] = { ...item, dueAt };
    }
    const started = await startExamSession(
      { pageId: PAGE, requestedCount: 10 },
      deps,
      OWNER,
    );
    if (!started.ok) throw started.error;
    const composed = await uow.run((repos) =>
      composeSessionQuestions(started.value.session, repos),
    );
    if (!composed.ok) throw composed.error;
    expect(composed.value.map((q) => q.id)).toEqual([
      "q-05",
      "q-03",
      "q-01",
      "q-02",
      "q-04",
      "q-06",
      "q-07",
      "q-08",
      "q-09",
      "q-10",
    ]);
    expect(questions).toHaveLength(12);

    // Questions added or retired after the start change nothing.
    const after = new Date(LATER.getTime() + 60_000);
    await seedSessionQuestions(uow, 3, { createdAt: after, prefix: "late" });
    await uow.repos.questions.retire("q-05", OWNER, after);
    const again = await uow.run((repos) =>
      composeSessionQuestions(started.value.session, repos),
    );
    if (!again.ok) throw again.error;
    expect(again.value.map((q) => q.id)).toEqual(
      composed.value.map((q) => q.id),
    );
  });
});
