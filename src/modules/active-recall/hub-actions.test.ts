import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecallHubPage } from "./domain/recall-hub-reader";

// Session, database, the hub reader and study-engine's page mastery and
// due items are mocked so this proves the hub Server Action
// boundary (session, mastery and due counts, view mapping, degraded
// reads, never-throw) without a database; listRecallHub,
// getRecallSessionReview and the reader are covered by their own tests.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const SESSION = "11111111-1111-4111-8111-111111111111";
const FINISHED = new Date("2026-10-07T10:00:00.000Z");

const state = vi.hoisted(() => ({
  pages: [] as unknown[],
  readerOwners: [] as string[],
  readerFails: false,
  masteryOwners: [] as string[],
  mastery: (async () => []) as () => Promise<unknown[]>,
  dueOwners: [] as string[],
  due: (async () => []) as () => Promise<unknown[]>,
  sessions: new Map<string, unknown>(),
  answers: [] as unknown[],
  questions: [] as unknown[],
}));

vi.mock("./infrastructure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./infrastructure")>()),
  DrizzleRecallHubReader: vi.fn(function DrizzleRecallHubReader() {
    return {
      async listRecallPages(ownerId: string) {
        state.readerOwners.push(ownerId);
        if (state.readerFails) throw new Error("db down");
        return state.pages;
      },
    };
  }),
  createDrizzleRecallRepositories: () => ({
    sessions: {
      async findById(id: string, ownerId: string) {
        return ownerId === OWNER ? (state.sessions.get(id) ?? null) : null;
      },
    },
    answers: {
      async listBySession() {
        return state.answers;
      },
    },
    questions: {
      async listByIds() {
        return state.questions;
      },
    },
  }),
}));
vi.mock("@/modules/study-engine", () => ({
  createPageMasteryReader: () => ({
    async listByOwner(ownerId: string) {
      state.masteryOwners.push(ownerId);
      return state.mastery();
    },
  }),
  createStudyItemRepository: () => ({
    async listDue(ownerId: string, now: Date) {
      expect(now).toBeInstanceOf(Date);
      state.dueOwners.push(ownerId);
      return state.due();
    },
  }),
}));

import {
  getRecallSessionReviewAction,
  listRecallHubAction,
} from "./hub-actions";

function hubPage(overrides: Partial<RecallHubPage> = {}): RecallHubPage {
  return {
    pageId: "page-1",
    pageTitle: "Mitocondria",
    notebookId: "nb-1",
    notebookTitle: "Biología",
    notebookColor: "green",
    sessions: [
      {
        id: "s-1",
        finishedAt: FINISHED,
        answers: [
          { aiScore: 5, combinedQuality: 4 },
          { aiScore: 1, combinedQuality: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

function dueItems(pageId: string, kind: string, count: number) {
  return Array.from({ length: count }, () => ({ pageId, kind }));
}

const SESSION_REQUIRED = {
  ok: false,
  error: {
    code: "RECALL_SESSION_REQUIRED",
    message: "Debes iniciar sesión para continuar.",
  },
};

describe("listRecallHubAction", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({ id: OWNER });
    state.pages = [hubPage()];
    state.readerOwners = [];
    state.readerFails = false;
    state.masteryOwners = [];
    state.mastery = async () => [{ pageId: "page-1", score: 0.42 }];
    state.dueOwners = [];
    state.due = async () => [
      ...dueItems("page-1", "recall_question", 3),
      ...dueItems("page-1", "flashcard", 5),
      ...dueItems("page-1", "exam_question", 2),
      ...dueItems("page-9", "recall_question", 2),
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("refuses without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await listRecallHubAction();

    expect(result).toEqual(SESSION_REQUIRED);
    expect(state.readerOwners).toEqual([]);
  });

  it("lists the caller's recall pages with their sessions, mastery and recall questions due today", async () => {
    const result = await listRecallHubAction();

    expect(state.readerOwners).toEqual([OWNER]);
    expect(state.masteryOwners).toEqual([OWNER]);
    expect(state.dueOwners).toEqual([OWNER]);
    expect(result).toEqual({
      ok: true,
      value: {
        averageMastery: 42,
        pages: [
          {
            pageId: "page-1",
            pageTitle: "Mitocondria",
            notebookId: "nb-1",
            notebookTitle: "Biología",
            notebookColor: "green",
            mastery: 42,
            dueToday: 3,
            sessions: [
              {
                id: "s-1",
                finishedAt: FINISHED.toISOString(),
                questionCount: 2,
                correct: 1,
                partial: 0,
                incorrect: 1,
                // (4 + 1) / 2 × 20
                percentage: 50,
              },
            ],
          },
        ],
      },
    });
  });

  it("still lists the pages, with unknown mastery and due counts, when those reads fail", async () => {
    const masteryFailure = new Error("mastery down");
    const dueFailure = new Error("due list down");
    state.mastery = async () => {
      throw masteryFailure;
    };
    state.due = async () => {
      throw dueFailure;
    };

    const result = await listRecallHubAction();

    expect(result.ok && result.value.averageMastery).toBeNull();
    expect(
      result.ok && result.value.pages.map((p) => [p.mastery, p.dueToday]),
    ).toEqual([[null, null]]);
    expect(captureException).toHaveBeenCalledWith(masteryFailure);
    expect(captureException).toHaveBeenCalledWith(dueFailure);
  });

  it("answers the unexpected error when the pages cannot be read", async () => {
    state.readerFails = true;

    const result = await listRecallHubAction();

    expect(result).toEqual({
      ok: false,
      error: {
        code: "RECALL_UNEXPECTED",
        message: "unexpected active recall action failure",
      },
    });
    expect(captureException).toHaveBeenCalled();
  });
});

describe("getRecallSessionReviewAction", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({ id: OWNER });
    state.sessions = new Map([
      [
        SESSION,
        {
          id: SESSION,
          ownerId: OWNER,
          pageId: PAGE,
          startedAt: FINISHED,
          finishedAt: FINISHED,
          evaluationStatus: "done",
        },
      ],
    ]);
    state.answers = [
      {
        id: "a-1",
        sessionId: SESSION,
        questionId: "q-1",
        answerText: "Produce ATP",
        selfRating: 4,
      },
    ];
    state.questions = [{ id: "q-1", prompt: "¿Qué produce?" }];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("refuses without a session", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(
      await getRecallSessionReviewAction({ pageId: PAGE, sessionId: SESSION }),
    ).toEqual(SESSION_REQUIRED);
  });

  it("refuses an invalid input", async () => {
    const result = await getRecallSessionReviewAction({
      pageId: PAGE,
      sessionId: "nope",
    });

    expect(!result.ok && result.error.code).toBe("RECALL_INVALID_INPUT");
  });

  it("returns the caller's finished session with its questions and answers", async () => {
    const result = await getRecallSessionReviewAction({
      pageId: PAGE,
      sessionId: SESSION,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: SESSION,
        pageId: PAGE,
        records: [
          {
            questionId: "q-1",
            prompt: "¿Qué produce?",
            answerText: "Produce ATP",
            selfRating: 4,
          },
        ],
      },
    });
  });

  it("answers not found for another page's session", async () => {
    const result = await getRecallSessionReviewAction({
      pageId: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
      sessionId: SESSION,
    });

    expect(!result.ok && result.error.code).toBe("RECALL_SESSION_NOT_FOUND");
  });
});
