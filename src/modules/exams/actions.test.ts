import { beforeEach, describe, expect, it, vi } from "vitest";
import { systemClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok } from "@/shared/kernel/result";
import { createExamQuestion } from "./application/create-exam-question";
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

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/shared/observability/analytics", () => ({
  createServerAnalytics: () => ({ track }),
}));
// The generation action is proven against a stubbed use case: this file
// checks the boundary around it (analytics, revalidation, error mapping).
vi.mock("@/modules/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ai")>()),
  createAiServerApi: () => ({ generationLimiter: {} }),
}));
const { requestExamGeneration } = vi.hoisted(() => ({
  requestExamGeneration: vi.fn(),
}));
vi.mock("./application", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./application")>()),
  requestExamGeneration,
}));

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
  DrizzleExamFingerprints: vi.fn(function DrizzleExamFingerprints() {
    return FINGERPRINTS;
  }),
  DrizzleExamQuestionRepository: vi.fn(
    function DrizzleExamQuestionRepository() {
      return current.uow.questions;
    },
  ),
}));

const { FINGERPRINTS } = vi.hoisted(() => ({
  FINGERPRINTS: { listByPage: async () => [], addMany: async () => {} },
}));
const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

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

// Questions are created by AI only (Phase 8 H13): there is no create action,
// so a question is seeded straight into the fakes through the use case,
// with its study item.
async function created() {
  const result = await createExamQuestion(
    { pageId: PAGE, ...QUESTION },
    {
      pages: {
        getPageText: async () => ok({ title: "Mitocondria", plainText: "x" }),
      },
      uow: current.uow,
      clock: systemClock,
      ids: { next: createId },
    },
    OWNER,
  );
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe("exams Server Actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    captureException.mockClear();
    revalidatePath.mockClear();
    track.mockReset();
    track.mockResolvedValue(undefined);
    requestExamGeneration.mockReset();
    current = {
      uow: new InMemoryExamUnitOfWork(),
      pageFound: true,
      throwOnPageRead: false,
    };
  });

  // Phase 8 H18: the edit page's "Guardar".
  describe("saveExamEditsAction", () => {
    it("rejects a malformed draft and an unauthenticated caller", async () => {
      const { saveExamEditsAction } = await actions();
      expect(
        await saveExamEditsAction({ pageId: PAGE, creates: [{}] }).then(
          (r) => !r.ok && r.error.code,
        ),
      ).toBe("EXAMS_INVALID_INPUT");
      getCurrentUser.mockResolvedValue(null);
      expect(
        await saveExamEditsAction({
          pageId: PAGE,
          updates: [],
          creates: [],
          deletes: [],
        }).then((r) => !r.ok && r.error.code),
      ).toBe("EXAMS_SESSION_REQUIRED");
    });

    it("saves the draft, answers the questions and revalidates", async () => {
      const a = await created();
      const b = await created();
      const { saveExamEditsAction } = await actions();

      const result = await saveExamEditsAction({
        pageId: PAGE,
        updates: [{ id: a.id, ...QUESTION, stem: "Editada" }],
        creates: [{ ...QUESTION, stem: "Nueva" }],
        deletes: [b.id],
      });

      expect(result.ok && result.value.map((q) => q.stem)).toEqual([
        "Editada",
        "Nueva",
      ]);
      expect(revalidatePath).toHaveBeenCalledWith("/exams", "layout");
    });

    it("refuses a draft that deletes every question", async () => {
      const a = await created();
      const { saveExamEditsAction } = await actions();

      const result = await saveExamEditsAction({
        pageId: PAGE,
        updates: [],
        creates: [],
        deletes: [a.id],
      });

      expect(!result.ok && result.error.code).toBe("EXAMS_LAST_QUESTION");
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("listExamQuestionsAction", () => {
    it("lists the page's active questions", async () => {
      const first = await created();
      const second = await created();
      const { listExamQuestionsAction, saveExamEditsAction } = await actions();
      await saveExamEditsAction({
        pageId: PAGE,
        updates: [],
        creates: [],
        deletes: [first.id],
      });

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

  describe("generateExamQuestionsAction", () => {
    const GENERATED = {
      provider: "fake",
      model: "fake-model",
      questions: [],
      skipped: 0,
      remainingToday: 4,
      truncated: false,
      wordsUsed: 10,
      wordsTotal: 10,
    };

    it("keeps a saved generation successful and revalidates when analytics rejects", async () => {
      requestExamGeneration.mockResolvedValue(ok(GENERATED));
      track.mockRejectedValue(new Error("posthog down"));
      const { generateExamQuestionsAction } = await actions();

      const result = await generateExamQuestionsAction({
        pageId: PAGE,
        count: 10,
      });

      expect(result).toEqual(
        ok(expect.objectContaining({ created: 0, remainingToday: 4 })),
      );
      expect(revalidatePath).toHaveBeenCalledWith("/exams", "layout");
      expect(track).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "posthog down" }),
      );
    });

    it("passes the exam fingerprints and tracks no_new_content for an unchanged page", async () => {
      requestExamGeneration.mockResolvedValue(
        err(new DomainError("EXAMS_NO_NEW_CONTENT", "nothing new")),
      );
      const { generateExamQuestionsAction } = await actions();

      const result = await generateExamQuestionsAction({ pageId: PAGE });

      expect(!result.ok && result.error.code).toBe("EXAMS_NO_NEW_CONTENT");
      expect(requestExamGeneration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ fingerprints: FINGERPRINTS }),
        OWNER,
      );
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(track).toHaveBeenCalledWith(
        "generation_requested",
        OWNER,
        expect.objectContaining({ status: "no_new_content" }),
      );
    });

    it("keeps the domain error of a refused generation when analytics rejects", async () => {
      requestExamGeneration.mockResolvedValue(
        err(new DomainError("PAGE_NOT_FOUND", PAGE)),
      );
      track.mockRejectedValue(new Error("posthog down"));
      const { generateExamQuestionsAction } = await actions();

      const result = await generateExamQuestionsAction({ pageId: PAGE });

      expect(!result.ok && result.error.code).toBe("PAGE_NOT_FOUND");
      expect(track).toHaveBeenCalledTimes(1);
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "posthog down" }),
      );
    });
  });
});
