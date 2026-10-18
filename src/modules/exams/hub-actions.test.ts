import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamHubPage } from "./domain/exam-hub-reader";

// Session, database, the hub reader and scheduling's due list are mocked so
// this proves the hub Server Action boundary (session, due counts from
// scheduling, view mapping, degraded due list, never-throw) without a
// database; listExamHub and the reader are covered by their own tests.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
// Reviews are due per local day of the profile's zone (Bogotá, -05).
vi.mock("@/modules/identity", () => ({
  getCurrentUser,
  getCurrentTimeZoneSetting: async () => ({
    status: "ok",
    timeZone: "America/Bogota",
    chosen: true,
  }),
}));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const FINISHED = new Date("2026-10-05T10:00:00.000Z");

const state = vi.hoisted(() => ({
  pages: [] as unknown[],
  readerOwners: [] as string[],
  dueOwners: [] as string[],
  due: (async () => []) as () => Promise<unknown[]>,
  dueItemOwners: [] as string[],
  dueItems: (async () => []) as () => Promise<unknown[]>,
}));

vi.mock("./infrastructure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./infrastructure")>()),
  DrizzleExamHubReader: vi.fn(function DrizzleExamHubReader() {
    return {
      async listExamPages(ownerId: string) {
        state.readerOwners.push(ownerId);
        return state.pages;
      },
    };
  }),
}));
vi.mock("@/modules/scheduling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/scheduling")>()),
  createSchedulingServerApi: () => ({
    async listDueToday(ownerId: string, day: { timeZone: string }) {
      expect(day).toEqual({ timeZone: "America/Bogota" });
      state.dueOwners.push(ownerId);
      return state.due();
    },
  }),
}));

vi.mock("@/modules/study-engine", () => ({
  createStudyItemRepository: () => ({
    async listDue(ownerId: string, dueBefore: Date) {
      // The start of the owner's next local day: 05:00 UTC in Bogotá.
      expect(dueBefore.getUTCHours()).toBe(5);
      expect(dueBefore.getUTCMinutes()).toBe(0);
      state.dueItemOwners.push(ownerId);
      return state.dueItems();
    },
  }),
}));

import { listExamHubAction } from "./hub-actions";

function hubPage(overrides: Partial<ExamHubPage> = {}): ExamHubPage {
  return {
    pageId: "page-1",
    pageTitle: "Mitocondria",
    notebookId: "nb-1",
    notebookTitle: "Biología",
    notebookColor: "green",
    activeQuestionCount: 12,
    attempts: 2,
    lastSession: { finishedAt: FINISHED, total: 10, correct: 6, passed: false },
    retakePending: true,
    failedRootIds: ["root-failed"],
    ...overrides,
  };
}

function dueRow(pageId: string, examQuestion: number, flashcard = 0) {
  return {
    pageId,
    pageTitle: "x",
    notebookId: "nb-1",
    notebookTitle: "Biología",
    notebookColor: "green",
    due: { flashcard, exam_question: examQuestion, recall_question: 0 },
    earliestDueAt: FINISHED,
  };
}

describe("listExamHubAction", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({ id: OWNER });
    state.pages = [hubPage(), hubPage({ pageId: "page-2", lastSession: null })];
    state.readerOwners = [];
    state.dueOwners = [];
    state.due = async () => [dueRow("page-1", 3, 5), dueRow("page-9", 2)];
    state.dueItemOwners = [];
    state.dueItems = async () => [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("refuses without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await listExamHubAction();

    expect(result).toEqual({
      ok: false,
      error: {
        code: "EXAMS_SESSION_REQUIRED",
        message: "Debes iniciar sesión para continuar.",
      },
    });
    expect(state.readerOwners).toEqual([]);
  });

  it("lists the caller's exam pages with their exam questions due today", async () => {
    const result = await listExamHubAction();

    expect(state.readerOwners).toEqual([OWNER]);
    expect(state.dueOwners).toEqual([OWNER]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          pageId: "page-1",
          pageTitle: "Mitocondria",
          notebookId: "nb-1",
          notebookTitle: "Biología",
          notebookColor: "green",
          questionCount: 12,
          attempts: 2,
          lastScore: 60,
          passed: false,
          lastFinishedAt: FINISHED.toISOString(),
          retakePending: true,
          dueToday: 3,
          failedDueNow: false,
        },
        expect.objectContaining({
          pageId: "page-2",
          lastScore: null,
          lastFinishedAt: null,
          dueToday: 0,
        }),
      ],
    });
  });

  it("still lists the pages, with unknown due counts, when the due list fails", async () => {
    const failure = new Error("due list down");
    state.due = async () => {
      throw failure;
    };

    const result = await listExamHubAction();

    expect(result.ok && result.value.map((page) => page.dueToday)).toEqual([
      null,
      null,
    ]);
    expect(captureException).toHaveBeenCalledWith(failure);
  });

  it("says the failed questions are due from the roots' due exam items only", async () => {
    state.dueItems = async () => [
      { kind: "exam_question", sourceId: "root-other" },
      { kind: "flashcard", sourceId: "root-failed" },
    ];
    const notYet = await listExamHubAction();
    state.dueItems = async () => [
      { kind: "exam_question", sourceId: "root-failed" },
    ];
    const due = await listExamHubAction();

    expect(state.dueItemOwners).toEqual([OWNER, OWNER]);
    expect(notYet.ok && notYet.value[0]?.failedDueNow).toBe(false);
    expect(due.ok && due.value[0]?.failedDueNow).toBe(true);
  });

  it("leaves the failed questions' due state unknown when the due items fail", async () => {
    const failure = new Error("study items down");
    state.dueItems = async () => {
      throw failure;
    };

    const result = await listExamHubAction();

    expect(result.ok && result.value[0]?.failedDueNow).toBeNull();
    expect(captureException).toHaveBeenCalledWith(failure);
  });

  it("answers the unexpected error when the pages cannot be read", async () => {
    state.pages = [];
    const { DrizzleExamHubReader } = await import("./infrastructure");
    vi.mocked(DrizzleExamHubReader).mockImplementationOnce(function broken() {
      return {
        async listExamPages() {
          throw new Error("db down");
        },
      } as never;
    });

    const result = await listExamHubAction();

    expect(result).toEqual({
      ok: false,
      error: {
        code: "EXAMS_UNEXPECTED",
        message: "unexpected exams action failure",
      },
    });
  });
});
