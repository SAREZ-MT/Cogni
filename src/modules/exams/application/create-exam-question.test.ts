import { beforeEach, describe, expect, it } from "vitest";
import { INITIAL_EASINESS } from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { EXAM_ERROR } from "../domain/errors";
import { createExamQuestion } from "./create-exam-question";
import { CONTENT, NOW, OTHER, OWNER, PAGE, pages } from "./testing/fixtures";
import { InMemoryExamUnitOfWork } from "./testing/in-memory-exam-unit-of-work";

let ids = 0;
function makeDeps() {
  const uow = new InMemoryExamUnitOfWork();
  return {
    uow,
    deps: {
      pages,
      uow,
      clock: createFixedClock(NOW),
      ids: { next: () => `id-${++ids}` },
    },
  };
}

describe("createExamQuestion", () => {
  beforeEach(() => {
    ids = 0;
  });

  it("saves a trimmed manual root question together with its due study item", async () => {
    const { deps, uow } = makeDeps();

    const result = await createExamQuestion(
      {
        pageId: PAGE,
        ...CONTENT,
        stem: `  ${CONTENT.stem} `,
        concept: " Función de la mitocondria ",
      },
      deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      ownerId: OWNER,
      pageId: PAGE,
      stem: CONTENT.stem,
      concept: "Función de la mitocondria",
      origin: "manual",
      generationId: null,
      variantOf: null,
      retiredAt: null,
    });
    expect(result.value.rootId).toBe(result.value.id);
    expect(await uow.questions.findById(result.value.id, OWNER)).toEqual(
      result.value,
    );
    expect(uow.studyItems.all()).toEqual([
      expect.objectContaining({
        ownerId: OWNER,
        pageId: PAGE,
        kind: "exam_question",
        sourceId: result.value.rootId,
        easiness: INITIAL_EASINESS,
        dueAt: NOW,
        suspendedAt: null,
      }),
    ]);
    expect(uow.runs).toBe(1);
  });

  it("refuses another owner's or a missing page without writing", async () => {
    const { deps, uow } = makeDeps();

    const foreign = await createExamQuestion(
      { pageId: PAGE, ...CONTENT },
      deps,
      OTHER,
    );
    const missing = await createExamQuestion(
      { pageId: "page-x", ...CONTENT },
      deps,
      OWNER,
    );

    expect(!foreign.ok && foreign.error.code).toBe("PAGE_NOT_FOUND");
    expect(!missing.ok && missing.error.code).toBe("PAGE_NOT_FOUND");
    expect(uow.runs).toBe(0);
    expect(uow.studyItems.all()).toEqual([]);
  });

  it.each([
    ["repeated options", { options: ["ATP", "atp", "Lípidos", "Almidón"] }],
    ["three options", { options: ["ATP", "ADN", "Lípidos"] }],
    ["a correct index out of range", { correctIndex: 4 }],
    ["a blank concept", { concept: "  " }],
    ["a blank stem", { stem: " " }],
  ])("refuses %s as an invalid question, writing nothing", async (_, patch) => {
    const { deps, uow } = makeDeps();

    const result = await createExamQuestion(
      { pageId: PAGE, ...CONTENT, ...patch },
      deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(EXAM_ERROR.INVALID_QUESTION);
    expect(uow.questions.snapshot()).toEqual([]);
    expect(uow.studyItems.all()).toEqual([]);
  });

  it("rolls the question back when its study item cannot be written", async () => {
    const { deps, uow } = makeDeps();
    uow.studyItems.failNextSave = true;

    await expect(
      createExamQuestion({ pageId: PAGE, ...CONTENT }, deps, OWNER),
    ).rejects.toThrow("study item write failed");

    expect(uow.questions.snapshot()).toEqual([]);
    expect(uow.studyItems.all()).toEqual([]);
  });
});
