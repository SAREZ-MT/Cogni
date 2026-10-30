import { beforeEach, describe, expect, it } from "vitest";
import { newStudyItem } from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { EXAM_ERROR } from "../domain/errors";
import type { ExamQuestion } from "../domain/exam-question";
import { applyExamEdits } from "./apply-exam-edits";
import { deleteExamQuestion } from "./delete-exam-question";
import {
  CONTENT,
  LATER,
  NOW,
  OTHER,
  OWNER,
  PAGE,
  pages,
  question,
} from "./testing/fixtures";
import { InMemoryExamUnitOfWork } from "./testing/in-memory-exam-unit-of-work";

async function seed(uow: InMemoryExamUnitOfWork, ...questions: ExamQuestion[]) {
  for (const q of questions) {
    await uow.questions.save(q);
    if (q.rootId === q.id) {
      await uow.studyItems.save(
        newStudyItem({
          id: `item-${q.id}`,
          ownerId: OWNER,
          pageId: q.pageId,
          kind: "exam_question",
          sourceId: q.id,
          now: NOW,
        }),
      );
    }
  }
}

const itemOf = (uow: InMemoryExamUnitOfWork, rootId: string) =>
  uow.studyItems.all().find((item) => item.sourceId === rootId);

// A variant of `root` in its lineage, active.
const variant = (id: string, root: string): ExamQuestion => ({
  ...question(id, { stem: `Variante ${id}` }),
  rootId: root,
  variantOf: root,
  origin: "ai_variant",
});

const CREATE = { ...CONTENT, stem: "¿Nueva pregunta?" };

describe("deleteExamQuestion", () => {
  let uow: InMemoryExamUnitOfWork;
  beforeEach(() => {
    uow = new InMemoryExamUnitOfWork();
  });

  it("deletes the question's whole lineage and its root's study item, and drops the lineage from open exams", async () => {
    await seed(uow, question("q-1"), variant("q-1b", "q-1"), question("q-2"));

    const result = await deleteExamQuestion(
      { questionId: "q-1b" },
      { uow },
      OWNER,
    );

    expect(result.ok && result.value.remaining).toBe(1);
    expect(await uow.questions.findById("q-1", OWNER)).toBeNull();
    expect(await uow.questions.findById("q-1b", OWNER)).toBeNull();
    expect(itemOf(uow, "q-1")).toBeUndefined();
    expect(uow.lineageRefs.dropped).toEqual([
      { pageId: PAGE, rootId: "q-1", questionIds: ["q-1", "q-1b"] },
    ]);
  });

  it("keeps the page's last question and another owner's", async () => {
    await seed(uow, question("q-1"));

    const last = await deleteExamQuestion(
      { questionId: "q-1" },
      { uow },
      OWNER,
    );
    const foreign = await deleteExamQuestion(
      { questionId: "q-1" },
      { uow },
      OTHER,
    );

    expect(!last.ok && last.error.code).toBe(EXAM_ERROR.LAST_QUESTION);
    expect(!foreign.ok && foreign.error.code).toBe(
      EXAM_ERROR.QUESTION_NOT_FOUND,
    );
    expect(await uow.questions.findById("q-1", OWNER)).not.toBeNull();
  });
});

describe("applyExamEdits", () => {
  let uow: InMemoryExamUnitOfWork;
  let n = 0;
  const deps = () => ({
    pages,
    uow,
    clock: createFixedClock(LATER),
    ids: { next: () => `new-${++n}` },
  });

  beforeEach(() => {
    uow = new InMemoryExamUnitOfWork();
    n = 0;
  });

  it("edits, adds a manual question with its study item and deletes, in one unit of work", async () => {
    await seed(uow, question("q-1"), question("q-2"), question("q-3"));

    const result = await applyExamEdits(
      {
        pageId: PAGE,
        updates: [{ id: "q-1", ...CONTENT, stem: "Editada", correctIndex: 2 }],
        creates: [{ ...CONTENT, stem: "Nueva" }],
        deletes: ["q-2"],
      },
      deps(),
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(uow.runs).toBe(1);
    expect(result.value.questions.map((q) => q.stem)).toEqual([
      "Editada",
      CONTENT.stem,
      "Nueva",
    ]);
    expect(result.value.questions[0]?.correctIndex).toBe(2);
    const created = result.value.questions.at(-1);
    expect(created?.origin).toBe("manual");
    expect(itemOf(uow, created?.id ?? "")).toBeDefined();
    expect(itemOf(uow, "q-2")).toBeUndefined();
  });

  // V10: a save from a page loaded before a newer change (another tab)
  // must not overwrite it.
  it("refuses an edit of a question changed since the page loaded, writing nothing", async () => {
    const stored = question("q-1");
    await seed(uow, stored, question("q-2"));

    const stale = await applyExamEdits(
      {
        pageId: PAGE,
        updates: [
          {
            id: "q-1",
            ...CONTENT,
            stem: "Encima",
            expectedUpdatedAt: "2026-09-01T10:00:00.000Z",
          },
        ],
        creates: [],
        deletes: ["q-2"],
      },
      deps(),
      OWNER,
    );
    const current = await applyExamEdits(
      {
        pageId: PAGE,
        updates: [
          {
            id: "q-1",
            ...CONTENT,
            stem: "Al día",
            expectedUpdatedAt: stored.updatedAt.toISOString(),
          },
        ],
        creates: [],
        deletes: [],
      },
      deps(),
      OWNER,
    );

    expect(!stale.ok && stale.error.code).toBe(EXAM_ERROR.CHANGED);
    expect(current.ok && current.value.questions.map((q) => q.stem)).toEqual([
      "Al día",
      CONTENT.stem,
    ]);
  });

  it("deletes a lineage once even when two of its questions are deleted", async () => {
    await seed(uow, question("q-1"), variant("q-1b", "q-1"), question("q-2"));

    const result = await applyExamEdits(
      { pageId: PAGE, updates: [], creates: [], deletes: ["q-1", "q-1b"] },
      deps(),
      OWNER,
    );

    expect(result.ok && result.value.questions.map((q) => q.id)).toEqual([
      "q-2",
    ]);
  });

  it("rolls everything back when the save would leave the page without questions", async () => {
    await seed(uow, question("q-1"));

    const result = await applyExamEdits(
      {
        pageId: PAGE,
        updates: [{ id: "q-1", ...CONTENT, stem: "Cambio" }],
        creates: [],
        deletes: ["q-1"],
      },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(EXAM_ERROR.LAST_QUESTION);
    expect((await uow.questions.findById("q-1", OWNER))?.stem).toBe(
      CONTENT.stem,
    );
    expect(itemOf(uow, "q-1")).toBeDefined();
  });

  it("validates every question before writing", async () => {
    await seed(uow, question("q-1"));

    const result = await applyExamEdits(
      {
        pageId: PAGE,
        updates: [],
        creates: [{ ...CONTENT, options: ["A", "A", "B", "C"] }],
        deletes: [],
      },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(EXAM_ERROR.INVALID_QUESTION);
    expect(uow.runs).toBe(0);
  });

  it("refuses a question of another page and another owner's page", async () => {
    await seed(uow, question("q-1"), question("q-x", { pageId: "page-2" }));

    const other = await applyExamEdits(
      {
        pageId: PAGE,
        updates: [{ id: "q-x", ...CONTENT }],
        creates: [],
        deletes: [],
      },
      deps(),
      OWNER,
    );
    const page = await applyExamEdits(
      { pageId: PAGE, updates: [], creates: [CONTENT], deletes: [] },
      deps(),
      OTHER,
    );

    expect(!other.ok && other.error.code).toBe(EXAM_ERROR.QUESTION_NOT_FOUND);
    expect(!page.ok && page.error.code).toBe("PAGE_NOT_FOUND");
  });

  // The app's pool holds one connection (shared/db/client.ts): a page read
  // from inside the transaction would wait for that connection forever.
  // The page is read once, before the unit of work.
  it("reads the page once, before the unit of work, never inside it", async () => {
    const base = deps();
    let inside = false;
    let reads = 0;
    const uow = base.uow;
    const guarded = {
      run: async <T>(work: Parameters<typeof uow.run>[0]) => {
        inside = true;
        try {
          return (await uow.run(work as never)) as T;
        } finally {
          inside = false;
        }
      },
    };
    const result = await applyExamEdits(
      { pageId: PAGE, updates: [], creates: [CREATE], deletes: [] },
      {
        ...base,
        uow: guarded as never,
        pages: {
          getPageText: async (pageId: string, ownerId: string) => {
            if (inside) throw new Error("page read inside the transaction");
            reads += 1;
            return base.pages.getPageText(pageId, ownerId);
          },
        },
      },
      OWNER,
    );

    expect(result.ok).toBe(true);
    expect(reads).toBe(1);
  });
});
