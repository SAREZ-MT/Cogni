import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { EXAM_ERROR } from "../domain/errors";
import { editExamQuestion } from "./edit-exam-question";
import { LATER, NOW, OTHER, OWNER, question } from "./testing/fixtures";
import { InMemoryExamUnitOfWork } from "./testing/in-memory-exam-unit-of-work";

async function seeded(...questions: ReturnType<typeof question>[]) {
  const uow = new InMemoryExamUnitOfWork();
  for (const q of questions) await uow.questions.save(q);
  return { uow, deps: { uow, clock: createFixedClock(LATER) } };
}

const EDIT = {
  stem: "¿Qué molécula produce la mitocondria?",
  options: ["ADN", "ATP", "Glucosa", "Agua"],
  correctIndex: 1,
  explanation: "",
  concept: "Respiración celular",
};

describe("editExamQuestion", () => {
  it("edits the question in place, keeping its id, root and origin", async () => {
    const { uow, deps } = await seeded(question("q-1"));

    const result = await editExamQuestion(
      { questionId: "q-1", ...EDIT },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: "q-1",
      rootId: "q-1",
      origin: "manual",
      ...EDIT,
      createdAt: NOW,
      updatedAt: LATER,
    });
    expect(await uow.questions.findById("q-1", OWNER)).toEqual(result.value);
  });

  it("refuses a retired question", async () => {
    const { uow, deps } = await seeded(question("q-1", { retiredAt: NOW }));

    const result = await editExamQuestion(
      { questionId: "q-1", ...EDIT },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(EXAM_ERROR.QUESTION_RETIRED);
    expect((await uow.questions.findById("q-1", OWNER))?.stem).not.toBe(
      EDIT.stem,
    );
  });

  it("refuses another owner's or a missing question as not found", async () => {
    const { uow, deps } = await seeded(question("q-1"));

    const foreign = await editExamQuestion(
      { questionId: "q-1", ...EDIT },
      deps,
      OTHER,
    );
    const missing = await editExamQuestion(
      { questionId: "q-x", ...EDIT },
      deps,
      OWNER,
    );

    expect(!foreign.ok && foreign.error.code).toBe(
      EXAM_ERROR.QUESTION_NOT_FOUND,
    );
    expect(!missing.ok && missing.error.code).toBe(
      EXAM_ERROR.QUESTION_NOT_FOUND,
    );
    expect((await uow.questions.findById("q-1", OWNER))?.stem).not.toBe(
      EDIT.stem,
    );
  });

  it("refuses invalid content", async () => {
    const { deps } = await seeded(question("q-1"));

    const result = await editExamQuestion(
      { questionId: "q-1", ...EDIT, options: ["A", "B", "C", "a"] },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(EXAM_ERROR.INVALID_QUESTION);
  });
});
