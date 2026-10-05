import { beforeEach, describe, expect, it } from "vitest";
import {
  type AiGeneration,
  AiGenerationFailedError,
  type GenerateStructuredInput,
  type GenerationRateLimit,
} from "@/modules/ai";
import {
  type FlashcardSession,
  newFlashcardSession,
  newStudyItem,
  type Quality,
  type ReviewLog,
  type SessionFeedback,
  type SessionFeedbackRepository,
  type SessionKind,
  type StudyItem,
} from "@/modules/study-engine";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { createFlashcard } from "../domain";
import {
  type RequestSessionFeedbackDeps,
  requestSessionFeedback,
  STALE_PENDING_MS,
} from "./request-session-feedback";
import { InMemoryFlashcardRepository } from "./testing/in-memory-flashcard-repository";

const OWNER = "owner-1";
const OTHER = "owner-2";
const PAGE = "page-1";
const SESSION = "session-1";
const STARTED = new Date("2026-10-04T09:00:00.000Z");
const NOW = new Date("2026-10-04T09:10:00.000Z");
const RESET = new Date("2026-10-05T00:00:00.000Z");

const FEEDBACK_OBJECT = {
  summary: "Buena sesión.",
  strengths: ["Recordaste la mitocondria"],
  toReinforce: ["La mitosis"],
  nextStepSuggestion: "Repasa la mitosis mañana.",
};

// Same unique (kind, session) rule as the table; the shared contract is
// proven against study-engine's own fake and the Drizzle adapter.
class StubFeedbackRepository implements SessionFeedbackRepository {
  readonly rows = new Map<string, SessionFeedback>();
  creates = 0;
  // Statuses whose update throws, to simulate a database failure.
  failUpdatesOf = new Set<SessionFeedback["status"]>();
  async create(feedback: SessionFeedback): Promise<boolean> {
    this.creates += 1;
    if (this.rows.has(feedback.sessionId)) return false;
    this.rows.set(feedback.sessionId, feedback);
    return true;
  }
  async findBySession(
    kind: SessionKind,
    sessionId: string,
    ownerId: string,
  ): Promise<SessionFeedback | null> {
    const row = this.rows.get(sessionId);
    return row && row.sessionKind === kind && row.ownerId === ownerId
      ? row
      : null;
  }
  async update(feedback: SessionFeedback): Promise<void> {
    if (this.failUpdatesOf.has(feedback.status)) {
      throw new Error("database unavailable");
    }
    this.rows.set(feedback.sessionId, feedback);
  }
  async reclaimStalePending(
    kind: SessionKind,
    sessionId: string,
    ownerId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<SessionFeedback | null> {
    const row = await this.findBySession(kind, sessionId, ownerId);
    if (!row || row.status !== "pending" || row.updatedAt >= staleBefore) {
      return null;
    }
    const reclaimed = { ...row, updatedAt: now };
    this.rows.set(sessionId, reclaimed);
    return reclaimed;
  }
}

function generation(id = "gen-1"): AiGeneration {
  return {
    id,
    ownerId: OWNER,
    pageId: PAGE,
    purpose: "session_feedback",
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
    promptVersion: "session_feedback/v1",
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
    status: "done",
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

type AiOutcome =
  | "ok"
  | "fail"
  | "error"
  | "throw"
  | "hang"
  | { object: unknown };

function makeAi(outcome: AiOutcome = "ok") {
  const calls: GenerateStructuredInput[] = [];
  return {
    calls,
    generateStructured: async (
      input: GenerateStructuredInput,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    > => {
      calls.push(input);
      if (outcome === "fail") return err(new AiGenerationFailedError("gen-x"));
      if (outcome === "error") {
        return err(new DomainError("AI_NO_PROVIDER_AVAILABLE", "none"));
      }
      if (outcome === "throw") throw new Error("network down");
      if (outcome === "hang") return new Promise(() => {});
      const object = outcome === "ok" ? FEEDBACK_OBJECT : outcome.object;
      return ok({ object, generation: generation() });
    },
  };
}

interface Fixture {
  deps: RequestSessionFeedbackDeps;
  ai: ReturnType<typeof makeAi>;
  feedback: StubFeedbackRepository;
  sessions: Map<string, FlashcardSession>;
  logs: ReviewLog[];
  items: Map<string, StudyItem>;
  flashcards: InMemoryFlashcardRepository;
  peeks: number;
}

let fx: Fixture;
let nextId = 0;

function build(
  options: { ai?: AiOutcome; allowed?: boolean; peekThrows?: boolean } = {},
): Fixture {
  const sessions = new Map<string, FlashcardSession>();
  const logs: ReviewLog[] = [];
  const items = new Map<string, StudyItem>();
  const flashcards = new InMemoryFlashcardRepository();
  const feedback = new StubFeedbackRepository();
  const ai = makeAi(options.ai);
  const fixture: Fixture = {
    ai,
    feedback,
    sessions,
    logs,
    items,
    flashcards,
    peeks: 0,
    deps: {
      sessions: {
        findById: async (id, ownerId) => {
          const s = sessions.get(id);
          return s && s.ownerId === ownerId ? s : null;
        },
      },
      reviewLogs: {
        listBySession: async (kind, sessionId, ownerId) =>
          logs.filter(
            (l) =>
              l.sessionKind === kind &&
              l.sessionId === sessionId &&
              l.ownerId === ownerId,
          ),
      },
      studyItems: {
        findById: async (id, ownerId) => {
          const item = items.get(id);
          return item && item.ownerId === ownerId ? item : null;
        },
      },
      flashcards,
      feedback,
      limiter: {
        peek: async (): Promise<GenerationRateLimit> => {
          fixture.peeks += 1;
          if (options.peekThrows) throw new Error("redis unavailable");
          return {
            allowed: options.allowed ?? true,
            remaining: options.allowed === false ? 0 : 3,
            resetAt: RESET,
          };
        },
      },
      ai,
      clock: createFixedClock(NOW),
      ids: { next: () => `id-${++nextId}` },
      aiTimeoutMs: 50,
    },
  };
  return fixture;
}

function addSession(
  overrides: Partial<FlashcardSession> = {},
): FlashcardSession {
  const session = {
    ...newFlashcardSession({
      id: SESSION,
      ownerId: OWNER,
      pageId: PAGE,
      now: STARTED,
    }),
    finishedAt: NOW,
    ...overrides,
  };
  fx.sessions.set(session.id, session);
  return session;
}

// One card with its item and one graded answer in the session.
async function grade(front: string, quality: Quality, minute: number) {
  const cardId = `card-${front}`;
  const card = createFlashcard(
    {
      id: cardId,
      ownerId: OWNER,
      pageId: PAGE,
      generationId: null,
      front,
      back: "respuesta",
      origin: "manual",
      position: await fx.flashcards.nextPosition(PAGE, OWNER),
    },
    STARTED,
  );
  if (!card.ok) throw card.error;
  await fx.flashcards.insertMany([card.value]);
  const item = newStudyItem({
    id: `item-${front}`,
    ownerId: OWNER,
    pageId: PAGE,
    kind: "flashcard",
    sourceId: cardId,
    now: STARTED,
  });
  fx.items.set(item.id, item);
  fx.logs.push({
    id: `log-${front}`,
    ownerId: OWNER,
    itemId: item.id,
    quality,
    reviewedAt: new Date(STARTED.getTime() + minute * 60_000),
    intervalBefore: 0,
    intervalAfter: 1,
    easinessAfter: 2.5,
    sessionKind: "flashcards",
    sessionId: SESSION,
  });
}

async function gradedSession() {
  addSession({ reviewedCount: 4, againCount: 1 });
  await grade("Bien", 4, 1);
  await grade("Difícil", 3, 2);
  await grade("Otra vez", 1, 3);
  await grade("Fácil", 5, 4);
}

describe("requestSessionFeedback", () => {
  beforeEach(() => {
    nextId = 0;
    fx = build();
  });

  it("stores done feedback with the AI content and its generation", async () => {
    await gradedSession();

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      ownerId: OWNER,
      sessionKind: "flashcards",
      sessionId: SESSION,
      status: "done",
      content: FEEDBACK_OBJECT,
      generationId: "gen-1",
    });
    expect(fx.feedback.rows.get(SESSION)).toEqual(result.value);
  });

  it("asks the session_feedback purpose with counts and the hardest fronts", async () => {
    await gradedSession();

    await requestSessionFeedback({ sessionId: SESSION }, fx.deps, OWNER);

    const [call] = fx.ai.calls;
    expect(call).toMatchObject({
      purpose: "session_feedback",
      pageId: PAGE,
      promptVersion: "session_feedback/v1",
    });
    expect(call?.prompt).toContain("Items reviewed: 4");
    expect(call?.prompt).toContain("Again: 1");
    expect(call?.prompt).toContain("Hard: 1");
    expect(call?.prompt).toContain("Good: 1");
    expect(call?.prompt).toContain("Easy: 1");
    // "Otra vez" first, then "Difícil"; well-known cards are not sent.
    const struggled = call?.prompt
      .split("\n")
      .filter((line) => line.startsWith("- "));
    expect(struggled).toEqual(["- Otra vez", "- Difícil"]);
  });

  it("stores failed feedback when the provider fails, and still returns ok", async () => {
    fx = build({ ai: "fail" });
    await gradedSession();

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      status: "failed",
      content: null,
      generationId: "gen-x",
    });
    expect(fx.feedback.rows.get(SESSION)?.status).toBe("failed");
  });

  it.each([
    ["no provider available", "error" as const],
    ["a thrown provider error", "throw" as const],
    ["an answer outside the schema", { object: { summary: "" } }],
  ])("stores failed feedback on %s", async (_label, outcome) => {
    fx = build({ ai: outcome });
    await gradedSession();

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok && result.value.status).toBe("failed");
    expect(fx.feedback.rows.get(SESSION)?.status).toBe("failed");
  });

  it("stores failed feedback without calling the AI when the daily limit is reached", async () => {
    fx = build({ allowed: false });
    await gradedSession();

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      status: "failed",
      generationId: null,
    });
    expect(fx.ai.calls).toHaveLength(0);
  });

  it("returns the stored feedback on a second request without calling the AI again", async () => {
    await gradedSession();
    const first = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    const second = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(second).toEqual(first);
    expect(fx.ai.calls).toHaveLength(1);
    expect(fx.peeks).toBe(1);
  });

  it("never retries a failed feedback", async () => {
    fx = build({ ai: "fail" });
    await gradedSession();
    await requestSessionFeedback({ sessionId: SESSION }, fx.deps, OWNER);

    const again = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(again.ok && again.value.status).toBe("failed");
    expect(fx.ai.calls).toHaveLength(1);
  });

  it("returns the winner's row when a concurrent request claimed the session", async () => {
    await gradedSession();
    const claimed = {
      id: "other-request",
      ownerId: OWNER,
      sessionKind: "flashcards" as const,
      sessionId: SESSION,
      status: "pending" as const,
      content: null,
      generationId: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    // The row appears between the lookup and the insert.
    const findBySession = fx.feedback.findBySession.bind(fx.feedback);
    let lookups = 0;
    fx.feedback.findBySession = async (kind, sessionId, ownerId) => {
      lookups += 1;
      if (lookups === 1) {
        fx.feedback.rows.set(SESSION, claimed);
        return null;
      }
      return findBySession(kind, sessionId, ownerId);
    };

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok && result.value).toEqual(claimed);
    expect(fx.ai.calls).toHaveLength(0);
  });

  it("stores failed feedback when reading the daily limit throws", async () => {
    fx = build({ peekThrows: true });
    await gradedSession();

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok && result.value.status).toBe("failed");
    expect(fx.feedback.rows.get(SESSION)?.status).toBe("failed");
    expect(fx.ai.calls).toHaveLength(0);
  });

  it("stores failed feedback when saving the done content throws", async () => {
    await gradedSession();
    fx.feedback.failUpdatesOf.add("done");

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      status: "failed",
      content: null,
      generationId: "gen-1",
    });
    expect(fx.feedback.rows.get(SESSION)?.status).toBe("failed");
  });

  it("still returns failed feedback when saving the failure throws too", async () => {
    fx = build({ ai: "fail" });
    await gradedSession();
    fx.feedback.failUpdatesOf.add("failed");

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok && result.value.status).toBe("failed");
    // The row stays pending; a later request reclaims it once stale.
    expect(fx.feedback.rows.get(SESSION)?.status).toBe("pending");
  });

  it("stores failed feedback when the AI does not answer in time", async () => {
    fx = build({ ai: "hang" });
    await gradedSession();

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(result.ok && result.value).toMatchObject({
      status: "failed",
      generationId: null,
    });
    expect(fx.feedback.rows.get(SESSION)?.status).toBe("failed");
  });

  describe("a pending row left by an earlier request", () => {
    function seedPending(ageMs: number): SessionFeedback {
      const at = new Date(NOW.getTime() - ageMs);
      const row: SessionFeedback = {
        id: "earlier-request",
        ownerId: OWNER,
        sessionKind: "flashcards",
        sessionId: SESSION,
        status: "pending",
        content: null,
        generationId: null,
        createdAt: at,
        updatedAt: at,
      };
      fx.feedback.rows.set(SESSION, row);
      return row;
    }

    it("is reclaimed once stale and the AI is asked again", async () => {
      await gradedSession();
      seedPending(STALE_PENDING_MS + 1);

      const result = await requestSessionFeedback(
        { sessionId: SESSION },
        fx.deps,
        OWNER,
      );

      expect(result.ok && result.value).toMatchObject({
        id: "earlier-request",
        status: "done",
        content: FEEDBACK_OBJECT,
      });
      expect(fx.ai.calls).toHaveLength(1);
      expect(fx.feedback.rows.get(SESSION)?.status).toBe("done");
    });

    it("keeps returning pending while it is fresh", async () => {
      await gradedSession();
      const row = seedPending(STALE_PENDING_MS - 1);

      const result = await requestSessionFeedback(
        { sessionId: SESSION },
        fx.deps,
        OWNER,
      );

      expect(result.ok && result.value).toEqual(row);
      expect(fx.ai.calls).toHaveLength(0);
      expect(fx.peeks).toBe(0);
    });

    it("returns the current row when a concurrent request reclaimed it first", async () => {
      await gradedSession();
      seedPending(STALE_PENDING_MS + 1);
      const reclaimedByOther = {
        ...fx.feedback.rows.get(SESSION),
        updatedAt: NOW,
      } as SessionFeedback;
      fx.feedback.reclaimStalePending = async () => {
        fx.feedback.rows.set(SESSION, reclaimedByOther);
        return null;
      };

      const result = await requestSessionFeedback(
        { sessionId: SESSION },
        fx.deps,
        OWNER,
      );

      expect(result.ok && result.value).toEqual(reclaimedByOther);
      expect(fx.ai.calls).toHaveLength(0);
    });

    it("never reclaims an old failed row", async () => {
      await gradedSession();
      const old = new Date(NOW.getTime() - 10 * STALE_PENDING_MS);
      fx.feedback.rows.set(SESSION, {
        ...seedPending(0),
        status: "failed",
        updatedAt: old,
      });

      const result = await requestSessionFeedback(
        { sessionId: SESSION },
        fx.deps,
        OWNER,
      );

      expect(result.ok && result.value.status).toBe("failed");
      expect(fx.ai.calls).toHaveLength(0);
    });
  });

  it("refuses another owner's session", async () => {
    await gradedSession();

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OTHER,
    );

    expect(!result.ok && result.error.code).toBe(
      "STUDY_ENGINE_SESSION_NOT_FOUND",
    );
    expect(fx.feedback.creates).toBe(0);
    expect(fx.ai.calls).toHaveLength(0);
  });

  it("refuses a session that is still open", async () => {
    addSession({ finishedAt: null, reviewedCount: 1 });
    await grade("Bien", 4, 1);

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      "FLASHCARDS_FEEDBACK_SESSION_OPEN",
    );
    expect(fx.feedback.creates).toBe(0);
  });

  it("refuses a session without graded answers", async () => {
    addSession();

    const result = await requestSessionFeedback(
      { sessionId: SESSION },
      fx.deps,
      OWNER,
    );

    expect(!result.ok && result.error.code).toBe(
      "FLASHCARDS_FEEDBACK_NOTHING_REVIEWED",
    );
    expect(fx.feedback.creates).toBe(0);
    expect(fx.ai.calls).toHaveLength(0);
  });
});
