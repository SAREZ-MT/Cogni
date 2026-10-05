import { describe, expect, it } from "vitest";
import { newStudyItem } from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { EXAM_ERROR } from "../domain/errors";
import { retireExamQuestion } from "./retire-exam-question";
import { LATER, NOW, OTHER, OWNER, PAGE, question } from "./testing/fixtures";
import { InMemoryExamUnitOfWork } from "./testing/in-memory-exam-unit-of-work";

async function seeded(...questions: ReturnType<typeof question>[]) {
  const uow = new InMemoryExamUnitOfWork();
  for (const q of questions) {
    await uow.questions.save(q);
    if (q.id === q.rootId) {
      await uow.studyItems.save(
        newStudyItem({
          id: `item-${q.id}`,
          ownerId: q.ownerId,
          pageId: PAGE,
          kind: "exam_question",
          sourceId: q.rootId,
          now: NOW,
        }),
      );
    }
  }
  return { uow, deps: { uow, clock: createFixedClock(LATER) } };
}

describe("retireExamQuestion", () => {
  it("retires the question and suspends its root's study item", async () => {
    const { uow, deps } = await seeded(question("q-1"), question("q-2"));

    const result = await retireExamQuestion({ questionId: "q-1" }, deps, OWNER);

    expect(result.ok && result.value).toMatchObject({
      id: "q-1",
      retiredAt: LATER,
    });
    expect(await uow.questions.listActiveByPage(PAGE, OWNER)).toEqual([
      expect.objectContaining({ id: "q-2" }),
    ]);
    const items = uow.studyItems.all();
    expect(items.find((i) => i.sourceId === "q-1")?.suspendedAt).toEqual(LATER);
    expect(items.find((i) => i.sourceId === "q-2")?.suspendedAt).toBeNull();
  });

  it("is idempotent: retiring again keeps the first retiredAt and succeeds", async () => {
    const { uow, deps } = await seeded(question("q-1"));
    await retireExamQuestion({ questionId: "q-1" }, deps, OWNER);

    const again = await retireExamQuestion(
      { questionId: "q-1" },
      { uow, clock: createFixedClock(new Date("2026-10-07T00:00:00Z")) },
      OWNER,
    );

    expect(again.ok && again.value.retiredAt).toEqual(LATER);
    expect(uow.studyItems.all()[0]?.suspendedAt).toEqual(LATER);
  });

  it("keeps the root's item active while another question of its lineage is active", async () => {
    const root = question("q-1", { retiredAt: NOW });
    const variant = question("q-1b", {
      rootId: "q-1",
      variantOf: "q-1",
      origin: "ai_variant",
      generationId: "gen-1",
    });
    const { uow, deps } = await seeded(root, variant);
    await uow.questions.retire("q-1", OWNER, NOW);
    const extra = question("q-1c", {
      rootId: "q-1",
      variantOf: "q-1",
      origin: "ai_variant",
      generationId: "gen-1",
    });
    await uow.questions.save(extra);

    await retireExamQuestion({ questionId: "q-1b" }, deps, OWNER);
    expect(uow.studyItems.all()[0]?.suspendedAt).toBeNull();

    await retireExamQuestion({ questionId: "q-1c" }, deps, OWNER);
    expect(uow.studyItems.all()[0]?.suspendedAt).toEqual(LATER);
  });

  it("refuses another owner's or a missing question as not found, changing nothing", async () => {
    const { uow, deps } = await seeded(question("q-1"));

    const foreign = await retireExamQuestion(
      { questionId: "q-1" },
      deps,
      OTHER,
    );
    const missing = await retireExamQuestion(
      { questionId: "q-x" },
      deps,
      OWNER,
    );

    expect(!foreign.ok && foreign.error.code).toBe(
      EXAM_ERROR.QUESTION_NOT_FOUND,
    );
    expect(!missing.ok && missing.error.code).toBe(
      EXAM_ERROR.QUESTION_NOT_FOUND,
    );
    expect((await uow.questions.findById("q-1", OWNER))?.retiredAt).toBeNull();
    expect(uow.studyItems.all()[0]?.suspendedAt).toBeNull();
  });
});
