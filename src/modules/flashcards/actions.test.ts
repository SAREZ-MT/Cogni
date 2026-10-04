import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_ERROR,
  type AiGeneration,
  AiGenerationFailedError,
  type GenerationRateLimit,
} from "@/modules/ai";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { InMemoryFlashcardRepository } from "./application/testing/in-memory-flashcard-repository";

// Session, composition roots and analytics are mocked so this proves the
// Server Action boundary (session, Zod validation, ActionError mapping,
// analytics, never-throw) without a database or providers; same pattern as
// ingestion/actions.test.ts.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/modules/identity", () => ({ getCurrentUser }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/shared/config/env.server", () => ({
  serverEnv: () => ({
    AI_PAGE_TOKEN_CAP: 12000,
    NEXT_PUBLIC_POSTHOG_KEY: undefined,
    NEXT_PUBLIC_POSTHOG_HOST: undefined,
  }),
}));
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/shared/observability/analytics", () => ({
  createServerAnalytics: () => ({ track }),
}));

const RESET = new Date("2026-10-05T00:00:00.000Z");
const generation: AiGeneration = {
  id: "gen-1",
  ownerId: "o1",
  pageId: null,
  purpose: "generate_flashcards",
  provider: "gemini",
  model: "gemini-3.5-flash-lite",
  promptVersion: "generate_flashcards/v1",
  inputTokens: 1,
  outputTokens: 1,
  latencyMs: 1,
  status: "done",
  error: null,
  createdAt: RESET,
  updatedAt: RESET,
};

let current: {
  flashcards: InMemoryFlashcardRepository;
  limit: GenerationRateLimit;
  checks: number;
  pageText: { title: string; plainText: string } | null;
  generate: () => Promise<unknown>;
  throwOnPageRead: boolean;
};

vi.mock("@/modules/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ai")>()),
  createAiServerApi: () => ({
    entries: [],
    generateStructured: () => current.generate(),
    generationLimiter: {
      check: async () => {
        current.checks += 1;
        return current.limit;
      },
      peek: async () => current.limit,
    },
  }),
}));
vi.mock("@/modules/notebooks", () => ({
  createNotebooksServerApi: () => ({
    getPageText: async () => {
      if (current.throwOnPageRead) throw new Error("db down");
      return current.pageText
        ? ok(current.pageText)
        : err(new DomainError("PAGE_NOT_FOUND", "x"));
    },
  }),
}));
vi.mock("./infrastructure", () => ({
  DrizzleFlashcardRepository: vi.fn(function DrizzleFlashcardRepository() {
    return current.flashcards;
  }),
}));

const OWNER = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const PAGE = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

async function actions() {
  return import("./actions");
}

describe("flashcards Server Actions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getCurrentUser.mockResolvedValue({ id: OWNER });
    captureException.mockClear();
    track.mockClear();
    current = {
      flashcards: new InMemoryFlashcardRepository(),
      limit: { allowed: true, remaining: 4, resetAt: RESET },
      checks: 0,
      pageText: { title: "Tema", plainText: "uno dos tres" },
      generate: async () =>
        ok({
          object: { cards: [{ front: "P", back: "R" }] },
          generation,
        }),
      throwOnPageRead: false,
    };
  });

  describe("generateFlashcardsAction", () => {
    it("rejects an unauthenticated caller before doing anything", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { generateFlashcardsAction } = await actions();

      const result = await generateFlashcardsAction({ pageId: PAGE });

      expect(!result.ok && result.error.code).toBe(
        "FLASHCARDS_SESSION_REQUIRED",
      );
      expect(current.checks).toBe(0);
      expect(track).not.toHaveBeenCalled();
    });

    it.each([
      [{ pageId: "nope" }],
      [{ pageId: PAGE, count: 2 }],
      [{ pageId: PAGE, count: 21 }],
      [{ pageId: PAGE, count: 5.5 }],
      [null],
    ])("rejects invalid input %j", async (input) => {
      const { generateFlashcardsAction } = await actions();

      const result = await generateFlashcardsAction(input);

      expect(!result.ok && result.error.code).toBe("FLASHCARDS_INVALID_INPUT");
      expect(current.checks).toBe(0);
    });

    it("generates, returns a plain view and tracks generation_requested", async () => {
      const { generateFlashcardsAction } = await actions();

      const result = await generateFlashcardsAction({ pageId: PAGE, count: 5 });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toMatchObject({
        remainingToday: 4,
        truncated: false,
        wordsUsed: 3,
        wordsTotal: 3,
      });
      expect(result.value.cards).toHaveLength(1);
      expect(result.value.cards[0]).toMatchObject({
        front: "P",
        back: "R",
        position: 0,
      });
      expect(await current.flashcards.countByPage(PAGE, OWNER)).toBe(1);
      expect(track).toHaveBeenCalledWith("generation_requested", OWNER, {
        pageId: PAGE,
        provider: "gemini",
        model: "gemini-3.5-flash-lite",
        status: "done",
        truncated: false,
      });
    });

    it("maps the daily limit to an ActionError with resetAt and tracks limit", async () => {
      current.limit = { allowed: false, remaining: 0, resetAt: RESET };
      const { generateFlashcardsAction } = await actions();

      const result = await generateFlashcardsAction({ pageId: PAGE });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatchObject({
        code: AI_ERROR.DAILY_LIMIT_REACHED,
        resetAt: RESET.toISOString(),
      });
      expect(track).toHaveBeenCalledWith(
        "generation_requested",
        OWNER,
        expect.objectContaining({
          status: "limit",
          provider: null,
          model: null,
        }),
      );
    });

    it("tracks empty for a blank page", async () => {
      current.pageText = { title: "T", plainText: " " };
      const { generateFlashcardsAction } = await actions();

      const result = await generateFlashcardsAction({ pageId: PAGE });

      expect(!result.ok && result.error.code).toBe(AI_ERROR.PAGE_EMPTY);
      expect(track).toHaveBeenCalledWith(
        "generation_requested",
        OWNER,
        expect.objectContaining({ status: "empty" }),
      );
    });

    it("maps a generation failure and tracks failed", async () => {
      current.generate = async () => err(new AiGenerationFailedError("gen-x"));
      const { generateFlashcardsAction } = await actions();

      const result = await generateFlashcardsAction({ pageId: PAGE });

      expect(!result.ok && result.error.code).toBe(AI_ERROR.GENERATION_FAILED);
      expect(track).toHaveBeenCalledWith(
        "generation_requested",
        OWNER,
        expect.objectContaining({ status: "failed" }),
      );
    });

    it("never throws: an unexpected failure is reported to Sentry", async () => {
      current.throwOnPageRead = true;
      const { generateFlashcardsAction } = await actions();

      const result = await generateFlashcardsAction({ pageId: PAGE });

      expect(!result.ok && result.error.code).toBe("FLASHCARDS_UNEXPECTED");
      expect(captureException).toHaveBeenCalledTimes(1);
    });
  });

  describe("listFlashcardsAction", () => {
    it("rejects an unauthenticated caller", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { listFlashcardsAction } = await actions();
      const result = await listFlashcardsAction({ pageId: PAGE });
      expect(!result.ok && result.error.code).toBe(
        "FLASHCARDS_SESSION_REQUIRED",
      );
    });

    it("rejects an invalid page id", async () => {
      const { listFlashcardsAction } = await actions();
      const result = await listFlashcardsAction({ pageId: "x" });
      expect(!result.ok && result.error.code).toBe("FLASHCARDS_INVALID_INPUT");
    });

    it("lists the caller's cards in position order", async () => {
      const { generateFlashcardsAction, listFlashcardsAction } =
        await actions();
      await generateFlashcardsAction({ pageId: PAGE });

      const result = await listFlashcardsAction({ pageId: PAGE });

      expect(result.ok && result.value.map((c) => c.front)).toEqual(["P"]);
    });
  });

  describe("getGenerationStatusAction", () => {
    it("rejects an unauthenticated caller", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { getGenerationStatusAction } = await actions();
      const result = await getGenerationStatusAction();
      expect(!result.ok && result.error.code).toBe(
        "FLASHCARDS_SESSION_REQUIRED",
      );
    });

    it("returns the remaining count without consuming a unit", async () => {
      const { getGenerationStatusAction } = await actions();

      const result = await getGenerationStatusAction();

      expect(result).toEqual({
        ok: true,
        value: { remainingToday: 4, resetAt: RESET.toISOString() },
      });
      expect(current.checks).toBe(0);
    });
  });

  describe("listDecksAction", () => {
    it("rejects an unauthenticated caller", async () => {
      getCurrentUser.mockResolvedValue(null);
      const { listDecksAction } = await actions();
      const result = await listDecksAction();
      expect(!result.ok && result.error.code).toBe(
        "FLASHCARDS_SESSION_REQUIRED",
      );
    });

    it("lists the caller's decks as plain views with the derived counts", async () => {
      current.flashcards = new InMemoryFlashcardRepository(() => ({
        notebookId: "n1",
        pageTitle: "Mitocondria",
        notebookTitle: "Biología",
        notebookColor: "purple",
      }));
      const { generateFlashcardsAction, listDecksAction } = await actions();
      await generateFlashcardsAction({ pageId: PAGE });

      const result = await listDecksAction();

      expect(result).toEqual({
        ok: true,
        value: [
          {
            pageId: PAGE,
            notebookId: "n1",
            pageTitle: "Mitocondria",
            notebookTitle: "Biología",
            notebookColor: "purple",
            count: 1,
          },
        ],
      });
    });

    it("never throws: an unexpected failure is reported to Sentry", async () => {
      current.flashcards = {
        countByOwnerGroupedByPage: async () => {
          throw new Error("db down");
        },
      } as unknown as InMemoryFlashcardRepository;
      const { listDecksAction } = await actions();

      const result = await listDecksAction();

      expect(!result.ok && result.error.code).toBe("FLASHCARDS_UNEXPECTED");
      expect(captureException).toHaveBeenCalledTimes(1);
    });
  });
});
