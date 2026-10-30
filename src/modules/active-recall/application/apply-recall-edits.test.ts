import { beforeEach, describe, expect, it, vi } from "vitest";
import { newStudyItem } from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { RECALL_ERROR } from "../domain/errors";
import type { RecallQuestion } from "../domain/recall-question";
import { applyRecallEdits } from "./apply-recall-edits";
import { deleteRecallQuestion } from "./delete-recall-question";
import { editRecallQuestion } from "./edit-recall-question";
import { InMemoryRecallUnitOfWork } from "./testing/in-memory-recall-unit-of-work";

const OWNER = "owner-1";
const OTHER = "owner-2";
const PAGE = "page-1";
const CREATED = new Date("2026-10-01T10:00:00.000Z");
const NOW = new Date("2026-10-29T10:00:00.000Z");

function question(id: string, n: number, pageId = PAGE): RecallQuestion {
  return {
    id,
    ownerId: OWNER,
    pageId,
    prompt: `Pregunta ${n}`,
    rubric: {
      keyConcepts: [`Concepto ${n}`],
      acceptableAnswerSummary: `Resumen ${n}`,
    },
    origin: "ai",
    generationId: "gen-1",
    archivedAt: null,
    createdAt: new Date(CREATED.getTime() + n * 1000),
    updatedAt: CREATED,
  };
}

async function seed(
  uow: InMemoryRecallUnitOfWork,
  count: number,
  pageId = PAGE,
) {
  const questions = Array.from({ length: count }, (_, i) =>
    question(`${pageId}-q${i}`, i, pageId),
  );
  await uow.questions.saveMany(questions);
  for (const q of questions) {
    await uow.studyItems.save(
      newStudyItem({
        id: `item-${q.id}`,
        ownerId: OWNER,
        pageId,
        kind: "recall_question",
        sourceId: q.id,
        now: CREATED,
      }),
    );
  }
  return questions;
}

const itemOf = (uow: InMemoryRecallUnitOfWork, id: string) =>
  uow.studyItems.all().find((item) => item.sourceId === id);

const pages = {
  async getPageText(pageId: string, ownerId: string) {
    return ownerId === OWNER
      ? ok({ title: "Página", plainText: "" })
      : err(new DomainError("PAGE_NOT_FOUND", pageId));
  },
};

const content = (prompt: string) => ({
  prompt,
  keyConcepts: ["Idea A", " Idea B "],
  acceptableAnswerSummary: "Lo que se espera",
});

const CREATE = {
  prompt: "Nueva",
  keyConcepts: ["Idea"],
  acceptableAnswerSummary: "R",
};

describe("editRecallQuestion", () => {
  let uow: InMemoryRecallUnitOfWork;
  beforeEach(() => {
    uow = new InMemoryRecallUnitOfWork();
  });

  it("rewrites the prompt and rubric in place, trimmed", async () => {
    const [first] = await seed(uow, 2);

    const result = await editRecallQuestion(
      { questionId: first?.id ?? "", ...content(" Nueva pregunta ") },
      { uow, clock: createFixedClock(NOW) },
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      id: first?.id,
      prompt: "Nueva pregunta",
      rubric: {
        keyConcepts: ["Idea A", "Idea B"],
        acceptableAnswerSummary: "Lo que se espera",
      },
      origin: "ai",
      updatedAt: NOW,
    });
  });

  it("refuses an empty rubric and another owner's question", async () => {
    const [first] = await seed(uow, 1);
    const deps = { uow, clock: createFixedClock(NOW) };

    const invalid = await editRecallQuestion(
      {
        questionId: first?.id ?? "",
        prompt: "P",
        keyConcepts: [],
        acceptableAnswerSummary: "R",
      },
      deps,
      OWNER,
    );
    const foreign = await editRecallQuestion(
      { questionId: first?.id ?? "", ...content("P") },
      deps,
      OTHER,
    );

    expect(!invalid.ok && invalid.error.code).toBe(
      RECALL_ERROR.INVALID_QUESTION,
    );
    expect(!foreign.ok && foreign.error.code).toBe(
      RECALL_ERROR.QUESTION_NOT_FOUND,
    );
  });
});

describe("deleteRecallQuestion", () => {
  let uow: InMemoryRecallUnitOfWork;
  beforeEach(() => {
    uow = new InMemoryRecallUnitOfWork();
  });

  it("removes the question and its study item for good", async () => {
    const [first] = await seed(uow, 2);

    const result = await deleteRecallQuestion(
      { questionId: first?.id ?? "" },
      { uow },
      OWNER,
    );

    expect(result.ok && result.value.remaining).toBe(1);
    expect(uow.questions.rows.has(first?.id ?? "")).toBe(false);
    expect(itemOf(uow, first?.id ?? "")).toBeUndefined();
  });

  it("keeps the page's last question", async () => {
    const [only] = await seed(uow, 1);

    const result = await deleteRecallQuestion(
      { questionId: only?.id ?? "" },
      { uow },
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(RECALL_ERROR.LAST_QUESTION);
    expect(uow.questions.rows.has(only?.id ?? "")).toBe(true);
  });

  // Two saves deleting different questions at once must not both see two
  // active questions and leave the page with none (V10).
  it("locks the page before counting its active questions", async () => {
    const [first] = await seed(uow, 2);
    const lock = vi.spyOn(uow.questions, "lockPage");
    const count = vi.spyOn(uow.questions, "listActiveByPage");

    await deleteRecallQuestion({ questionId: first?.id ?? "" }, { uow }, OWNER);

    expect(lock).toHaveBeenCalledWith(PAGE, OWNER);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
      count.mock.invocationCallOrder[0] ?? 0,
    );
  });
});

describe("applyRecallEdits", () => {
  let uow: InMemoryRecallUnitOfWork;
  let n = 0;
  const deps = () => ({
    pages,
    uow,
    clock: createFixedClock(NOW),
    ids: { next: () => `new-${++n}` },
  });

  beforeEach(() => {
    uow = new InMemoryRecallUnitOfWork();
    n = 0;
  });

  it("edits, adds a manual question with its study item and deletes, in one unit of work", async () => {
    const [a, b, c] = await seed(uow, 3);

    const result = await applyRecallEdits(
      {
        pageId: PAGE,
        updates: [{ id: a?.id ?? "", ...content("A editada") }],
        creates: [content("Nueva")],
        deletes: [b?.id ?? ""],
      },
      deps(),
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(uow.runs).toBe(1);
    expect(result.value.questions.map((q) => q.prompt)).toEqual([
      "A editada",
      c?.prompt,
      "Nueva",
    ]);
    const created = result.value.questions.at(-1);
    expect(created).toMatchObject({ origin: "manual", generationId: null });
    expect(itemOf(uow, created?.id ?? "")?.kind).toBe("recall_question");
    expect(itemOf(uow, b?.id ?? "")).toBeUndefined();
  });

  // V10: a save from a page loaded before a newer change (another tab)
  // must not overwrite it.
  it("refuses an edit of a question changed since the page loaded, writing nothing", async () => {
    const [a, b] = await seed(uow, 2);

    const stale = await applyRecallEdits(
      {
        pageId: PAGE,
        updates: [
          {
            id: a?.id ?? "",
            ...content("Encima"),
            expectedUpdatedAt: "2026-09-01T10:00:00.000Z",
          },
        ],
        creates: [],
        deletes: [b?.id ?? ""],
      },
      deps(),
      OWNER,
    );
    const current = await applyRecallEdits(
      {
        pageId: PAGE,
        updates: [
          {
            id: a?.id ?? "",
            ...content("Al día"),
            expectedUpdatedAt: CREATED.toISOString(),
          },
        ],
        creates: [],
        deletes: [],
      },
      deps(),
      OWNER,
    );

    expect(!stale.ok && stale.error.code).toBe(RECALL_ERROR.CHANGED);
    expect(uow.questions.rows.has(b?.id ?? "")).toBe(true);
    expect(current.ok && current.value.questions[0]?.prompt).toBe("Al día");
  });

  it("rolls everything back when the save would leave the page without questions", async () => {
    const [a, b] = await seed(uow, 2);

    const result = await applyRecallEdits(
      {
        pageId: PAGE,
        updates: [{ id: a?.id ?? "", ...content("Cambio") }],
        creates: [],
        deletes: [a?.id ?? "", b?.id ?? ""],
      },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(RECALL_ERROR.LAST_QUESTION);
    expect(uow.questions.rows.get(a?.id ?? "")?.prompt).toBe("Pregunta 0");
    expect(itemOf(uow, b?.id ?? "")).toBeDefined();
  });

  it("validates every item before writing", async () => {
    const [a] = await seed(uow, 1);

    const result = await applyRecallEdits(
      {
        pageId: PAGE,
        updates: [{ id: a?.id ?? "", ...content("Cambio") }],
        creates: [content(" ")],
        deletes: [],
      },
      deps(),
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(RECALL_ERROR.INVALID_QUESTION);
    expect(uow.runs).toBe(0);
  });

  it("refuses a question of another page and another owner's page", async () => {
    await seed(uow, 1);
    const [foreign] = await seed(uow, 1, "page-2");

    const other = await applyRecallEdits(
      { pageId: PAGE, updates: [], creates: [], deletes: [foreign?.id ?? ""] },
      deps(),
      OWNER,
    );
    const page = await applyRecallEdits(
      { pageId: PAGE, updates: [], creates: [content("P")], deletes: [] },
      deps(),
      OTHER,
    );

    expect(!other.ok && other.error.code).toBe(RECALL_ERROR.QUESTION_NOT_FOUND);
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
    const result = await applyRecallEdits(
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
