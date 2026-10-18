import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { RECALL_ERROR } from "../domain/errors";
import { startRecallSession } from "./start-recall-session";
import { InMemoryRecallSessionUnitOfWork } from "./testing/in-memory-recall-session-unit-of-work";
import {
  dueCutoff,
  NOW,
  OTHER_OWNER,
  OTHER_PAGE,
  OWNER,
  PAGE,
  pages,
  seedQuestions,
} from "./testing/session-fixtures";

function setup() {
  const uow = new InMemoryRecallSessionUnitOfWork();
  let n = 0;
  const deps = {
    pages,
    uow,
    clock: createFixedClock(NOW),
    dueCutoff,
    ids: { next: () => `session-${++n}` },
  };
  return { uow, deps };
}

function ids(count: number, prefix = "q") {
  return Array.from(
    { length: count },
    (_, i) => `${prefix}-${String(i).padStart(2, "0")}`,
  );
}

describe("startRecallSession", () => {
  it("creates an open, pending session with up to ten questions", async () => {
    const { uow, deps } = setup();
    await seedQuestions(
      uow,
      ids(12).map((id) => ({ id })),
    );

    const result = await startRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session).toEqual({
      id: "session-1",
      ownerId: OWNER,
      pageId: PAGE,
      startedAt: NOW,
      finishedAt: null,
      evaluationStatus: "pending",
    });
    expect(result.value.questions.map((q) => q.id)).toEqual(ids(10));
    expect(result.value.questions[0]?.prompt).toBe("¿Pregunta q-00?");
    expect(await uow.repos.sessions.findById("session-1", OWNER)).toEqual(
      result.value.session,
    );
  });

  it("puts due questions first, then new ones, then the least recently reviewed", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [
      { id: "later-recent", reviewedDay: -1, dueDay: 5 },
      { id: "new-b", createdDay: -2 },
      { id: "due-late", reviewedDay: -9, dueDay: -1 },
      { id: "later-old", reviewedDay: -8, dueDay: 3 },
      { id: "new-a", createdDay: -3 },
      { id: "due-early", reviewedDay: -10, dueDay: -4 },
      { id: "due-now", reviewedDay: -2, dueDay: 0 },
    ]);

    const result = await startRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.questions.map((q) => q.id)).toEqual([
      "due-early",
      "due-late",
      "due-now",
      "new-a",
      "new-b",
      "later-old",
      "later-recent",
    ]);
  });

  it("counts a question due later today as due: the whole local day is review time", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [
      { id: "new", createdDay: -2 },
      // 21:36 UTC, before the owner's day ends at midnight.
      { id: "due-tonight", reviewedDay: -3, dueDay: 0.4 },
      // 00:00 tomorrow: not due yet.
      { id: "due-tomorrow", reviewedDay: -4, dueDay: 0.5 },
    ]);

    const result = await startRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.questions.map((q) => q.id)).toEqual([
      "due-tonight",
      "new",
      "due-tomorrow",
    ]);
  });

  it("starts with reviewed questions only when nothing is due or new", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [
      { id: "b", reviewedDay: -1, dueDay: 2 },
      { id: "a", reviewedDay: -5, dueDay: 9 },
    ]);

    const result = await startRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.questions.map((q) => q.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("leaves out archived questions, suspended items and questions without an item", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [
      { id: "kept" },
      { id: "archived", archived: true },
      { id: "suspended", suspended: true },
      { id: "no-item", noItem: true },
      { id: "elsewhere", pageId: OTHER_PAGE },
    ]);

    const result = await startRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(result.ok && result.value.questions.map((q) => q.id)).toEqual([
      "kept",
    ]);
  });

  it("refuses a page without active questions and writes nothing", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [
      { id: "archived", archived: true },
      { id: "elsewhere", pageId: OTHER_PAGE },
    ]);

    const result = await startRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(RECALL_ERROR.NO_QUESTIONS);
    expect(uow.repos.sessions.rows.size).toBe(0);
  });

  it("refuses when no active question can be scheduled", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [{ id: "suspended", suspended: true }]);

    const result = await startRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(!result.ok && result.error.code).toBe(RECALL_ERROR.NO_QUESTIONS);
    expect(uow.repos.sessions.rows.size).toBe(0);
  });

  it("refuses another owner's or an unknown page", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [{ id: "q" }]);

    for (const [pageId, ownerId] of [
      [PAGE, OTHER_OWNER],
      ["page-unknown", OWNER],
    ] as const) {
      const result = await startRecallSession({ pageId }, deps, ownerId);
      expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
    }
    expect(uow.repos.sessions.rows.size).toBe(0);
  });

  it("opens a new session on every start", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [{ id: "q" }]);

    await startRecallSession({ pageId: PAGE }, deps, OWNER);
    const second = await startRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(second.ok && second.value.session.id).toBe("session-2");
    expect(uow.repos.sessions.rows.size).toBe(2);
  });
});
