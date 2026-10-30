import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { planRecallSession } from "./plan-recall-session";
import { InMemoryRecallSessionUnitOfWork } from "./testing/in-memory-recall-session-unit-of-work";
import {
  dueCutoff,
  NOW,
  OTHER_OWNER,
  OWNER,
  PAGE,
  seedQuestions,
} from "./testing/session-fixtures";

function setup() {
  const uow = new InMemoryRecallSessionUnitOfWork();
  const deps = {
    questions: uow.repos.questions,
    studyItems: uow.repos.studyItems,
    clock: createFixedClock(NOW),
    dueCutoff,
  };
  return { uow, deps };
}

describe("planRecallSession", () => {
  it("lists the questions a session started now would show, writing nothing", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [
      { id: "later", reviewedDay: -1, dueDay: 5 },
      { id: "new" },
      { id: "due", reviewedDay: -3, dueDay: -1 },
    ]);

    const plan = await planRecallSession({ pageId: PAGE }, deps, OWNER);

    expect(plan.questions).toEqual([
      { id: "due", prompt: "¿Pregunta due?" },
      { id: "new", prompt: "¿Pregunta new?" },
      { id: "later", prompt: "¿Pregunta later?" },
    ]);
    expect(uow.repos.sessions.rows.size).toBe(0);
    expect(uow.runs).toBe(0);
  });

  it("is empty for a page without questions or another owner's page", async () => {
    const { uow, deps } = setup();
    await seedQuestions(uow, [{ id: "q" }]);

    expect(
      (await planRecallSession({ pageId: "page-empty" }, deps, OWNER))
        .questions,
    ).toEqual([]);
    expect(
      (await planRecallSession({ pageId: PAGE }, deps, OTHER_OWNER)).questions,
    ).toEqual([]);
  });
});
