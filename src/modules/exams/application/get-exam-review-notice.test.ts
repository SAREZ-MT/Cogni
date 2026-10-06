import { beforeEach, describe, expect, it } from "vitest";
import { type ExamQuestion, editExamQuestion } from "../domain/exam-question";
import { getExamReviewNotice } from "./get-exam-review-notice";
import {
  LATER,
  OTHER,
  OWNER,
  PAGE,
  seedSessionQuestions,
} from "./testing/fixtures";
import { InMemoryExamSessionUnitOfWork } from "./testing/in-memory-exam-session-unit-of-work";

let uow: InMemoryExamSessionUnitOfWork;
let questions: ExamQuestion[];

async function failRoots(roots: string[], retakePending = true) {
  await uow.repos.pageStates.upsert({
    pageId: PAGE,
    ownerId: OWNER,
    retakePending,
    failedRootIds: roots,
    lastPassedSessionId: null,
  });
}

beforeEach(async () => {
  uow = new InMemoryExamSessionUnitOfWork();
  questions = await seedSessionQuestions(uow, 10);
});

describe("getExamReviewNotice", () => {
  it("is null for a page without exam history", async () => {
    const result = await getExamReviewNotice({ pageId: PAGE }, { uow }, OWNER);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("is null when no retake is pending", async () => {
    await failRoots([], false);
    const result = await getExamReviewNotice({ pageId: PAGE }, { uow }, OWNER);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("lists the failed concepts of the pending retake in the stored order", async () => {
    await failRoots([questions[3].rootId, questions[0].rootId]);

    const result = await getExamReviewNotice({ pageId: PAGE }, { uow }, OWNER);

    expect(result).toEqual({
      ok: true,
      value: { failedConcepts: ["Concepto q-04", "Concepto q-01"] },
    });
  });

  it("uses each root's current concept and lists a shared concept once", async () => {
    const edited = editExamQuestion(
      questions[0],
      { concept: "Concepto q-02" },
      LATER,
    );
    if (!edited.ok) throw edited.error;
    await uow.repos.questions.update(edited.value);
    await failRoots([questions[0].rootId, questions[1].rootId]);

    const result = await getExamReviewNotice({ pageId: PAGE }, { uow }, OWNER);

    expect(result).toEqual({
      ok: true,
      value: { failedConcepts: ["Concepto q-02"] },
    });
  });

  it("leaves out roots retired since the exam, and is null when none is left", async () => {
    await uow.repos.questions.retire(questions[0].id, OWNER, LATER);
    await failRoots([questions[0].rootId, questions[1].rootId]);

    const some = await getExamReviewNotice({ pageId: PAGE }, { uow }, OWNER);
    expect(some).toEqual({
      ok: true,
      value: { failedConcepts: ["Concepto q-02"] },
    });

    await failRoots([questions[0].rootId]);
    const none = await getExamReviewNotice({ pageId: PAGE }, { uow }, OWNER);
    expect(none).toEqual({ ok: true, value: null });
  });

  it("is null for another owner", async () => {
    await failRoots([questions[0].rootId]);
    const result = await getExamReviewNotice({ pageId: PAGE }, { uow }, OTHER);
    expect(result).toEqual({ ok: true, value: null });
  });
});
