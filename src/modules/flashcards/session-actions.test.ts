import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlashcardSessionsServerApi } from "@/modules/study-engine";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { InMemoryFlashcardRepository } from "./application/testing/in-memory-flashcard-repository";
import { createFlashcard } from "./domain/flashcard";

// Session and composition roots are mocked: this proves the review-session
// Server Action boundary (session, Zod validation, card text join,
// ActionError mapping, revalidation, never-throw). The scheduling itself is
// covered by study-engine's use case and DB tests.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
const { requestSessionFeedback } = vi.hoisted(() => ({
  requestSessionFeedback: vi.fn(),
}));
vi.mock("./application/request-session-feedback", () => ({
  requestSessionFeedback,
}));
vi.mock("@/shared/config/env.server", () => ({ serverEnv: () => ({}) }));
vi.mock("@/modules/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ai")>()),
  createAiServerApi: () => ({ generationLimiter: {} }),
}));
vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: () => ({ getPageText: vi.fn() }),
}));

let current: {
  flashcards: InMemoryFlashcardRepository;
  sessions: {
    start: ReturnType<typeof vi.fn<FlashcardSessionsServerApi["start"]>>;
    grade: ReturnType<typeof vi.fn<FlashcardSessionsServerApi["grade"]>>;
    finish: ReturnType<typeof vi.fn<FlashcardSessionsServerApi["finish"]>>;
  };
};

vi.mock("@/modules/study-engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/study-engine")>()),
  createFlashcardSessionsServerApi: () => current.sessions,
  createSessionFeedbackSources: () => ({}),
}));
vi.mock("./infrastructure", () => ({
  DrizzleFlashcardRepository: vi.fn(function DrizzleFlashcardRepository() {
    return current.flashcards;
  }),
}));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const PAGE_2 = "1a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const SESSION = "7c1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const ITEM = "8d1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const NOW = new Date("2026-10-04T09:00:00.000Z");
const INTERVALS = { again: 1, hard: 1, good: 1, easy: 1 };

const session = (overrides = {}) => ({
  id: SESSION,
  ownerId: OWNER,
  pageId: PAGE,
  startedAt: NOW,
  finishedAt: null,
  reviewedCount: 0,
  againCount: 0,
  ...overrides,
});

async function addCard(id: string, pageId: string, front: string) {
  const card = createFlashcard(
    {
      id,
      ownerId: OWNER,
      pageId,
      generationId: null,
      front,
      back: `${front}?`,
      origin: "manual",
      position: await current.flashcards.nextPosition(pageId, OWNER),
    },
    NOW,
  );
  if (!card.ok) throw card.error;
  await current.flashcards.insertMany([card.value]);
}

async function actions() {
  return import("./session-actions");
}

describe("flashcard review session Server Actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    captureException.mockClear();
    revalidatePath.mockClear();
    requestSessionFeedback.mockReset();
    current = {
      flashcards: new InMemoryFlashcardRepository(),
      sessions: { start: vi.fn(), grade: vi.fn(), finish: vi.fn() },
    };
  });

  describe("startFlashcardSessionAction", () => {
    it("rejects an unauthenticated caller before doing anything", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { startFlashcardSessionAction } = await actions();

      const result = await startFlashcardSessionAction({ pageId: PAGE });

      expect(!result.ok && result.error.code).toBe(
        "FLASHCARDS_SESSION_REQUIRED",
      );
      expect(current.sessions.start).not.toHaveBeenCalled();
    });

    it.each([
      [{ pageId: "nope" }],
      [null],
      [{ pageId: 3 }],
    ])("rejects invalid input %j", async (input) => {
      const { startFlashcardSessionAction } = await actions();

      const result = await startFlashcardSessionAction(input);

      expect(!result.ok && result.error.code).toBe("FLASHCARDS_INVALID_INPUT");
      expect(current.sessions.start).not.toHaveBeenCalled();
    });

    it("returns the due cards with their text, in due order, across pages", async () => {
      await addCard("c1", PAGE, "Uno");
      await addCard("c2", PAGE_2, "Dos");
      current.sessions.start.mockResolvedValue(
        ok({
          session: session({ pageId: null }),
          items: [
            {
              itemId: "i2",
              flashcardId: "c2",
              pageId: PAGE_2,
              nextIntervalDays: INTERVALS,
            },
            {
              itemId: "i1",
              flashcardId: "c1",
              pageId: PAGE,
              nextIntervalDays: INTERVALS,
            },
            // A card that is no longer readable is left out.
            {
              itemId: "i3",
              flashcardId: "gone",
              pageId: PAGE,
              nextIntervalDays: INTERVALS,
            },
          ],
        }),
      );
      const { startFlashcardSessionAction } = await actions();

      const result = await startFlashcardSessionAction({});

      expect(current.sessions.start).toHaveBeenCalledWith(OWNER, {});
      expect(result).toEqual(
        ok({
          sessionId: SESSION,
          cards: [
            {
              itemId: "i2",
              flashcardId: "c2",
              front: "Dos",
              back: "Dos?",
              nextIntervalDays: INTERVALS,
            },
            {
              itemId: "i1",
              flashcardId: "c1",
              front: "Uno",
              back: "Uno?",
              nextIntervalDays: INTERVALS,
            },
          ],
        }),
      );
    });

    it("maps NOTHING_DUE to an ActionError", async () => {
      current.sessions.start.mockResolvedValue(
        err(new DomainError("STUDY_ENGINE_NOTHING_DUE", "No flashcard is due")),
      );
      const { startFlashcardSessionAction } = await actions();

      const result = await startFlashcardSessionAction({ pageId: PAGE });

      expect(result).toEqual(
        err({
          code: "STUDY_ENGINE_NOTHING_DUE",
          message: "No flashcard is due",
        }),
      );
    });

    it("never throws: an unexpected failure is reported and mapped", async () => {
      current.sessions.start.mockRejectedValue(new Error("db down"));
      const { startFlashcardSessionAction } = await actions();

      const result = await startFlashcardSessionAction({ pageId: PAGE });

      expect(!result.ok && result.error.code).toBe("FLASHCARDS_UNEXPECTED");
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe("gradeFlashcardAction", () => {
    it.each([
      [{ sessionId: SESSION, itemId: ITEM, rating: "meh" }],
      [{ sessionId: "x", itemId: ITEM, rating: "good" }],
      [{ sessionId: SESSION, itemId: "x", rating: "good" }],
      [{ sessionId: SESSION, rating: "good" }],
    ])("rejects invalid input %j", async (input) => {
      const { gradeFlashcardAction } = await actions();

      const result = await gradeFlashcardAction(input);

      expect(!result.ok && result.error.code).toBe("FLASHCARDS_INVALID_INPUT");
      expect(current.sessions.grade).not.toHaveBeenCalled();
    });

    it("grades and returns the counts and the page's mastery level", async () => {
      current.sessions.grade.mockResolvedValue(
        ok({
          item: {} as never,
          session: session({ reviewedCount: 3, againCount: 1 }),
          mastery: {
            id: "m",
            ownerId: OWNER,
            pageId: PAGE,
            level: "Aprendiendo",
            score: 0.2,
            itemsTotal: 4,
            itemsDue: 1,
            computedAt: NOW,
          },
        }),
      );
      const { gradeFlashcardAction } = await actions();

      const result = await gradeFlashcardAction({
        sessionId: SESSION,
        itemId: ITEM,
        rating: "again",
      });

      expect(current.sessions.grade).toHaveBeenCalledWith(OWNER, {
        sessionId: SESSION,
        itemId: ITEM,
        rating: "again",
      });
      expect(result).toEqual(
        ok({ reviewedCount: 3, againCount: 1, masteryLevel: "Aprendiendo" }),
      );
      // Grading mid-session never re-renders the deck under the player.
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("maps a refusal to an ActionError", async () => {
      current.sessions.grade.mockResolvedValue(
        err(new DomainError("STUDY_ENGINE_ITEM_NOT_DUE", ITEM)),
      );
      const { gradeFlashcardAction } = await actions();

      const result = await gradeFlashcardAction({
        sessionId: SESSION,
        itemId: ITEM,
        rating: "good",
      });

      expect(!result.ok && result.error.code).toBe("STUDY_ENGINE_ITEM_NOT_DUE");
    });
  });

  describe("finishFlashcardSessionAction", () => {
    it("closes the session, returns its counts and refreshes the decks", async () => {
      current.sessions.finish.mockResolvedValue(
        ok(session({ finishedAt: NOW, reviewedCount: 5, againCount: 2 })),
      );
      const { finishFlashcardSessionAction } = await actions();

      const result = await finishFlashcardSessionAction({ sessionId: SESSION });

      expect(current.sessions.finish).toHaveBeenCalledWith(OWNER, {
        sessionId: SESSION,
      });
      expect(result).toEqual(ok({ reviewedCount: 5, againCount: 2 }));
      expect(revalidatePath).toHaveBeenCalledWith("/flashcards", "layout");
    });

    it("rejects an unauthenticated caller", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { finishFlashcardSessionAction } = await actions();

      const result = await finishFlashcardSessionAction({ sessionId: SESSION });

      expect(!result.ok && result.error.code).toBe(
        "FLASHCARDS_SESSION_REQUIRED",
      );
      expect(current.sessions.finish).not.toHaveBeenCalled();
    });

    it("maps an unknown session to an ActionError without revalidating", async () => {
      current.sessions.finish.mockResolvedValue(
        err(new DomainError("STUDY_ENGINE_SESSION_NOT_FOUND", SESSION)),
      );
      const { finishFlashcardSessionAction } = await actions();

      const result = await finishFlashcardSessionAction({ sessionId: SESSION });

      expect(!result.ok && result.error.code).toBe(
        "STUDY_ENGINE_SESSION_NOT_FOUND",
      );
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("requestSessionFeedbackAction", () => {
    const feedbackRow = (overrides = {}) => ({
      id: "f1",
      ownerId: OWNER,
      sessionKind: "flashcards",
      sessionId: SESSION,
      status: "done",
      content: {
        summary: "Buena sesión.",
        strengths: ["Mitocondria"],
        toReinforce: ["Mitosis"],
        nextStepSuggestion: "Repasa mañana.",
      },
      generationId: "gen-1",
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    });

    it("returns the done feedback content for the owner's session", async () => {
      requestSessionFeedback.mockResolvedValue(ok(feedbackRow()));
      const { requestSessionFeedbackAction } = await actions();

      const result = await requestSessionFeedbackAction({ sessionId: SESSION });

      expect(requestSessionFeedback).toHaveBeenCalledWith(
        { sessionId: SESSION },
        expect.anything(),
        OWNER,
      );
      expect(result).toEqual(
        ok({
          status: "done",
          content: {
            summary: "Buena sesión.",
            strengths: ["Mitocondria"],
            toReinforce: ["Mitosis"],
            nextStepSuggestion: "Repasa mañana.",
          },
        }),
      );
    });

    it("returns a failed feedback as ok, without content", async () => {
      requestSessionFeedback.mockResolvedValue(
        ok(
          feedbackRow({ status: "failed", content: null, generationId: null }),
        ),
      );
      const { requestSessionFeedbackAction } = await actions();

      const result = await requestSessionFeedbackAction({ sessionId: SESSION });

      expect(result).toEqual(ok({ status: "failed", content: null }));
    });

    it("rejects an unauthenticated caller", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { requestSessionFeedbackAction } = await actions();

      const result = await requestSessionFeedbackAction({ sessionId: SESSION });

      expect(!result.ok && result.error.code).toBe(
        "FLASHCARDS_SESSION_REQUIRED",
      );
      expect(requestSessionFeedback).not.toHaveBeenCalled();
    });

    it("rejects invalid input", async () => {
      const { requestSessionFeedbackAction } = await actions();

      const result = await requestSessionFeedbackAction({ sessionId: "x" });

      expect(!result.ok && result.error.code).toBe("FLASHCARDS_INVALID_INPUT");
      expect(requestSessionFeedback).not.toHaveBeenCalled();
    });

    it("maps a refusal to an ActionError", async () => {
      requestSessionFeedback.mockResolvedValue(
        err(new DomainError("STUDY_ENGINE_SESSION_NOT_FOUND", SESSION)),
      );
      const { requestSessionFeedbackAction } = await actions();

      const result = await requestSessionFeedbackAction({ sessionId: SESSION });

      expect(!result.ok && result.error.code).toBe(
        "STUDY_ENGINE_SESSION_NOT_FOUND",
      );
    });

    it("never throws: an unexpected failure becomes FLASHCARDS_UNEXPECTED", async () => {
      requestSessionFeedback.mockRejectedValue(new Error("db down"));
      const { requestSessionFeedbackAction } = await actions();

      const result = await requestSessionFeedbackAction({ sessionId: SESSION });

      expect(!result.ok && result.error.code).toBe("FLASHCARDS_UNEXPECTED");
      expect(captureException).toHaveBeenCalled();
    });
  });
});
