import {
  type AiGeneration,
  AiGenerationFailedError,
  buildSessionFeedbackPrompt,
  type GenerateStructuredInput,
  type GenerationRateLimiter,
  type IdGenerator,
  SESSION_FEEDBACK_PROMPT_VERSION,
  sessionFeedbackOutput,
} from "@/modules/ai";
import {
  completeSessionFeedback,
  type FlashcardSessionRepository,
  failSessionFeedback,
  newSessionFeedback,
  type ReviewLog,
  type ReviewLogRepository,
  type SessionFeedback,
  type SessionFeedbackRepository,
  STUDY_ENGINE_ERROR,
  type StudyItemRepository,
} from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { FLASHCARD_ERROR } from "../domain/errors";
import type { FlashcardRepository } from "../domain/flashcard-repository";

export interface RequestSessionFeedbackDeps {
  sessions: Pick<FlashcardSessionRepository, "findById">;
  reviewLogs: Pick<ReviewLogRepository, "listBySession">;
  studyItems: Pick<StudyItemRepository, "findById">;
  flashcards: Pick<FlashcardRepository, "findById">;
  feedback: SessionFeedbackRepository;
  // Only `peek`: feedback respects the student's daily AI limit but does
  // not spend a generation of it.
  limiter: Pick<GenerationRateLimiter, "peek">;
  ai: {
    generateStructured(
      input: GenerateStructuredInput,
      ownerId: string,
    ): Promise<
      Result<{ object: unknown; generation: AiGeneration }, DomainError>
    >;
  };
  clock: Clock;
  ids: IdGenerator;
  // Overrides FEEDBACK_AI_TIMEOUT_MS (tests).
  aiTimeoutMs?: number;
}

// Longest wait for the AI answer. generateStructured may try two providers;
// past this the student gets the calm "no feedback" note instead of a
// spinner. The call itself is not cancelled (the provider port has no
// abort signal): its audit row still completes in the background.
export const FEEDBACK_AI_TIMEOUT_MS = 25_000;

// A "pending" row untouched for this long belongs to a request that died
// (function killed, crash) or hung: the next request may reclaim it. Well
// above FEEDBACK_AI_TIMEOUT_MS plus the surrounding reads and writes, so a
// live request is never overtaken.
export const STALE_PENDING_MS = 2 * 60_000;

class FeedbackTimeoutError extends Error {
  constructor() {
    super("The AI feedback did not arrive in time");
    this.name = "FeedbackTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FeedbackTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Answers a student struggled with: "Otra vez" (quality <= 2) and
// "Difícil" (3), documento-maestro §7.2.
const HARD_QUALITY = 3;

function countByButton(logs: readonly ReviewLog[]) {
  const counts = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const log of logs) {
    if (log.quality < HARD_QUALITY) counts.again += 1;
    else if (log.quality === HARD_QUALITY) counts.hard += 1;
    else if (log.quality === 4) counts.good += 1;
    else counts.easy += 1;
  }
  return counts;
}

// Fronts of the cards answered "Otra vez" or "Difícil", hardest first, each
// card once. A card that can no longer be read is left out.
async function struggledFronts(
  logs: readonly ReviewLog[],
  deps: RequestSessionFeedbackDeps,
  ownerId: string,
): Promise<string[]> {
  const hardest = logs
    .filter((log) => log.quality <= HARD_QUALITY)
    .sort((a, b) => a.quality - b.quality);
  const seen = new Set<string>();
  const fronts: string[] = [];
  for (const log of hardest) {
    if (seen.has(log.itemId)) continue;
    seen.add(log.itemId);
    const item = await deps.studyItems.findById(log.itemId, ownerId);
    if (!item) continue;
    const card = await deps.flashcards.findById(item.sourceId, ownerId);
    if (card) fronts.push(card.front);
  }
  return fronts;
}

// Claims the session's feedback row: inserts a new pending row, or takes
// over a stale pending one. Returns the claimed row, or the row another
// request holds (fresh pending, done, failed or a concurrent winner).
async function claim(
  session: { id: string },
  existing: SessionFeedback | null,
  deps: RequestSessionFeedbackDeps,
  ownerId: string,
): Promise<{ claimed: SessionFeedback } | { held: SessionFeedback | null }> {
  const now = deps.clock.now();
  if (existing) {
    const reclaimed = await deps.feedback.reclaimStalePending(
      "flashcards",
      session.id,
      ownerId,
      new Date(now.getTime() - STALE_PENDING_MS),
      now,
    );
    if (reclaimed) return { claimed: reclaimed };
  } else {
    const pending = newSessionFeedback({
      id: deps.ids.next(),
      ownerId,
      sessionKind: "flashcards",
      sessionId: session.id,
      now,
    });
    if (await deps.feedback.create(pending)) return { claimed: pending };
  }
  // A concurrent request claimed or reclaimed the row first: its row wins.
  return {
    held: await deps.feedback.findBySession("flashcards", session.id, ownerId),
  };
}

function isReclaimable(feedback: SessionFeedback, now: Date): boolean {
  return (
    feedback.status === "pending" &&
    now.getTime() - feedback.updatedAt.getTime() > STALE_PENDING_MS
  );
}

// AI feedback at the end of a flashcard review session (documento-maestro
// §3.3, §8.4). Idempotent per session: the first request claims the
// session's only feedback row and every later one reads it back. An AI
// failure (limit, provider, invalid answer, timeout, storage error) is
// stored as "failed" when possible and returned as ok: it never blocks
// closing the session. A pending row whose request died is reclaimed once
// stale (STALE_PENDING_MS); done and failed rows are final, even for a
// slow request that lost its row: it returns the stored outcome instead.
export async function requestSessionFeedback(
  input: { sessionId: string },
  deps: RequestSessionFeedbackDeps,
  ownerId: string,
): Promise<Result<SessionFeedback, DomainError>> {
  const session = await deps.sessions.findById(input.sessionId, ownerId);
  if (!session) {
    return err(
      new DomainError(STUDY_ENGINE_ERROR.SESSION_NOT_FOUND, input.sessionId),
    );
  }
  if (session.finishedAt === null) {
    return err(
      new DomainError(
        FLASHCARD_ERROR.FEEDBACK_SESSION_OPEN,
        "Feedback is given once the session is finished",
      ),
    );
  }

  const existing = await deps.feedback.findBySession(
    "flashcards",
    session.id,
    ownerId,
  );
  if (existing && !isReclaimable(existing, deps.clock.now())) {
    return ok(existing);
  }

  const logs = await deps.reviewLogs.listBySession(
    "flashcards",
    session.id,
    ownerId,
  );
  if (logs.length === 0) {
    return err(
      new DomainError(
        FLASHCARD_ERROR.FEEDBACK_NOTHING_REVIEWED,
        "The session has no graded answers",
      ),
    );
  }

  const claimed = await claim(session, existing, deps, ownerId);
  if ("held" in claimed) {
    return claimed.held
      ? ok(claimed.held)
      : err(
          new DomainError(
            STUDY_ENGINE_ERROR.SESSION_NOT_FOUND,
            input.sessionId,
          ),
        );
  }
  const pending = claimed.claimed;

  // Writes `next` only while the row is still pending. When the write did
  // not apply (another request settled the row meanwhile) or its outcome is
  // unknown (it threw, maybe after committing), the stored row is the
  // truth: a settled row wins, a still-pending one gives null.
  const settle = async (
    next: SessionFeedback,
  ): Promise<SessionFeedback | null> => {
    try {
      if (await deps.feedback.settlePending(next)) return next;
    } catch {
      // Unknown outcome: read the row back below.
    }
    try {
      const current = await deps.feedback.findBySession(
        "flashcards",
        session.id,
        ownerId,
      );
      return current && current.status !== "pending" ? current : null;
    } catch {
      return null;
    }
  };

  // Best effort: when even this write fails the row stays pending and a
  // later request reclaims it once stale; the student still gets the calm
  // failed note.
  const fail = async (generationId: string | null) => {
    const failed = failSessionFeedback(pending, generationId, deps.clock.now());
    return ok((await settle(failed)) ?? failed);
  };

  // Every error after the claim ends in "failed", never in a stuck row.
  try {
    const limit = await deps.limiter.peek(ownerId);
    if (!limit.allowed) return fail(null);

    let generated: Awaited<ReturnType<typeof deps.ai.generateStructured>>;
    try {
      const prompt = buildSessionFeedbackPrompt({
        technique: "flashcards",
        reviewedCount: logs.length,
        counts: countByButton(logs),
        struggled: await struggledFronts(logs, deps, ownerId),
      });
      generated = await withTimeout(
        deps.ai.generateStructured(
          {
            purpose: "session_feedback",
            pageId: session.pageId,
            promptVersion: SESSION_FEEDBACK_PROMPT_VERSION,
            ...prompt,
          },
          ownerId,
        ),
        deps.aiTimeoutMs ?? FEEDBACK_AI_TIMEOUT_MS,
      );
    } catch {
      return fail(null);
    }
    if (!generated.ok) {
      return fail(
        generated.error instanceof AiGenerationFailedError
          ? generated.error.generationId
          : null,
      );
    }

    const { generation } = generated.value;
    const parsed = sessionFeedbackOutput.safeParse(generated.value.object);
    if (!parsed.success) return fail(generation.id);

    const done = completeSessionFeedback(
      pending,
      parsed.data,
      generation.id,
      deps.clock.now(),
    );
    const settled = await settle(done);
    // Still pending: the done write did not commit, so fail the row.
    return settled ? ok(settled) : fail(generation.id);
  } catch {
    return fail(null);
  }
}
