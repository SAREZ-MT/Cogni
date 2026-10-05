import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { InMemoryExamUnitOfWork } from "./application/testing/in-memory-exam-unit-of-work";

// Session, composition roots and Sentry are mocked so this proves the
// Server Action boundary (session, Zod validation, ActionError mapping,
// never-throw) without a database; same pattern as flashcards/actions.test.ts.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
// actions.ts also hosts the generation action, which reads the server env
// (server-only); the question actions never call it.
vi.mock("@/shared/config/env.server", () => ({ serverEnv: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

let current: {
  uow: InMemoryExamUnitOfWork;
  pageFound: boolean;
  throwOnPageRead: boolean;
};

vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: () => ({
    getPageText: async (pageId: string) => {
      if (current.throwOnPageRead) throw new Error("db down");
      return current.pageFound
        ? ok({ title: "Mitocondria", plainText: "" })
        : err(new DomainError("PAGE_NOT_FOUND", pageId));
    },
  }),
}));
vi.mock("./infrastructure", () => ({
  DrizzleExamUnitOfWork: vi.fn(function DrizzleExamUnitOfWork() {
    return current.uow;
  }),
  DrizzleExamQuestionRepository: vi.fn(
    function DrizzleExamQuestionRepository() {
      return current.uow.questions;
    },
  ),
}));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const MISSING = "9f8e7d6c-5b4a-4392-8180-7f6e5d4c3b2a";

const QUESTION = {
  stem: "¿Qué produce la mitocondria?",
  options: ["ATP", "ADN", "Lípidos", "Almidón"],
  correctIndex: 0,
  explanation: "",
  concept: "Función de la mitocondria",
};

async function actions() {
  return import("./actions");
}

async function created() {
  const { createExamQuestionAction } = await actions();
  const result = await createExamQuestionAction({ pageId: PAGE, ...QUESTION });
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe("exams Server Actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    captureException.mockClear();
    revalidatePath.mockClear();
    current = {
      uow: new InMemoryExamUnitOfWork(),
      pageFound: true,
      throwOnPageRead: false,
    };
  });

  describe("createExamQuestionAction", () => {
    it("creates a manual question with its study item and revalidates the exams routes", async () => {
      const view = await created();

      expect(view).toMatchObject({
        pageId: PAGE,
        ...QUESTION,
        origin: "manual",
      });
      expect(current.uow.studyItems.all()).toEqual([
        expect.objectContaining({ kind: "exam_question", sourceId: view.id }),
      ]);
      expect(revalidatePath).toHaveBeenCalledWith("/exams", "layout");
    });

    it("rejects an unauthenticated caller before doing anything", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { createExamQuestionAction } = await actions();

      const result = await createExamQuestionAction({
        pageId: PAGE,
        ...QUESTION,
      });

      expect(!result.ok && result.error.code).toBe("EXAMS_SESSION_REQUIRED");
      expect(current.uow.runs).toBe(0);
    });

    it.each([
      ["a non-uuid page", { pageId: "x" }],
      ["a missing concept", { concept: undefined }],
      ["five options", { options: ["a", "b", "c", "d", "e"] }],
      ["a fractional index", { correctIndex: 1.5 }],
    ])("rejects %s as invalid input", async (_, patch) => {
      const { createExamQuestionAction } = await actions();

      const result = await createExamQuestionAction({
        pageId: PAGE,
        ...QUESTION,
        ...patch,
      });

      expect(!result.ok && result.error.code).toBe("EXAMS_INVALID_INPUT");
    });

    it("maps domain refusals to their codes", async () => {
      const { createExamQuestionAction } = await actions();

      const repeated = await createExamQuestionAction({
        pageId: PAGE,
        ...QUESTION,
        options: ["ATP", "atp", "B", "C"],
      });
      current.pageFound = false;
      const noPage = await createExamQuestionAction({
        pageId: MISSING,
        ...QUESTION,
      });

      expect(!repeated.ok && repeated.error.code).toBe(
        "EXAMS_INVALID_QUESTION",
      );
      expect(!noPage.ok && noPage.error.code).toBe("PAGE_NOT_FOUND");
    });

    it("never throws: an unexpected failure is reported and answered generically", async () => {
      current.throwOnPageRead = true;
      const { createExamQuestionAction } = await actions();

      const result = await createExamQuestionAction({
        pageId: PAGE,
        ...QUESTION,
      });

      expect(!result.ok && result.error.code).toBe("EXAMS_UNEXPECTED");
      expect(captureException).toHaveBeenCalledOnce();
    });
  });

  describe("editExamQuestionAction", () => {
    it("edits the question in place", async () => {
      const view = await created();
      const { editExamQuestionAction } = await actions();

      const result = await editExamQuestionAction({
        questionId: view.id,
        ...QUESTION,
        stem: "¿Qué molécula produce?",
      });

      expect(result.ok && result.value).toMatchObject({
        id: view.id,
        stem: "¿Qué molécula produce?",
      });
    });

    it("maps a retired or foreign question to its code", async () => {
      const view = await created();
      const { editExamQuestionAction, retireExamQuestionAction } =
        await actions();
      await retireExamQuestionAction({ questionId: view.id });

      const retired = await editExamQuestionAction({
        questionId: view.id,
        ...QUESTION,
      });
      const missing = await editExamQuestionAction({
        questionId: MISSING,
        ...QUESTION,
      });

      expect(!retired.ok && retired.error.code).toBe("EXAMS_QUESTION_RETIRED");
      expect(!missing.ok && missing.error.code).toBe(
        "EXAMS_QUESTION_NOT_FOUND",
      );
    });

    it("rejects an unauthenticated caller", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { editExamQuestionAction } = await actions();

      const result = await editExamQuestionAction({
        questionId: MISSING,
        ...QUESTION,
      });

      expect(!result.ok && result.error.code).toBe("EXAMS_SESSION_REQUIRED");
    });
  });

  describe("retireExamQuestionAction", () => {
    it("retires the question, suspends its item and revalidates", async () => {
      const view = await created();
      revalidatePath.mockClear();
      const { retireExamQuestionAction } = await actions();

      const result = await retireExamQuestionAction({ questionId: view.id });

      expect(result).toEqual({ ok: true, value: { id: view.id } });
      expect(current.uow.studyItems.all()[0]?.suspendedAt).not.toBeNull();
      expect(revalidatePath).toHaveBeenCalledWith("/exams", "layout");
    });

    it("rejects invalid input and unknown questions", async () => {
      const { retireExamQuestionAction } = await actions();

      const invalid = await retireExamQuestionAction({ questionId: 3 });
      const missing = await retireExamQuestionAction({ questionId: MISSING });

      expect(!invalid.ok && invalid.error.code).toBe("EXAMS_INVALID_INPUT");
      expect(!missing.ok && missing.error.code).toBe(
        "EXAMS_QUESTION_NOT_FOUND",
      );
    });
  });

  describe("listExamQuestionsAction", () => {
    it("lists the page's active questions", async () => {
      const first = await created();
      const second = await created();
      const { listExamQuestionsAction, retireExamQuestionAction } =
        await actions();
      await retireExamQuestionAction({ questionId: first.id });

      const result = await listExamQuestionsAction({ pageId: PAGE });

      expect(result.ok && result.value.map((q) => q.id)).toEqual([second.id]);
    });

    it("rejects an unauthenticated caller and invalid input", async () => {
      const { listExamQuestionsAction } = await actions();
      const invalid = await listExamQuestionsAction({ pageId: "nope" });
      getCurrentUser.mockResolvedValue(null);
      const anonymous = await listExamQuestionsAction({ pageId: PAGE });

      expect(!invalid.ok && invalid.error.code).toBe("EXAMS_INVALID_INPUT");
      expect(!anonymous.ok && anonymous.error.code).toBe(
        "EXAMS_SESSION_REQUIRED",
      );
    });
  });
});
