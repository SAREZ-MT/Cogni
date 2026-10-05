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

// AI feedback at the end of a flashcard review session (documento-maestro
// §3.3, §8.4). Idempotent per session: the first request claims the
// session's only feedback row and every later one reads it back. An AI
// failure (limit, provider, invalid answer) is stored as "failed" and
// returned as ok: it never blocks closing the session.
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
  if (existing) return ok(existing);

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

  const pending = newSessionFeedback({
    id: deps.ids.next(),
    ownerId,
    sessionKind: "flashcards",
    sessionId: session.id,
    now: deps.clock.now(),
  });
  if (!(await deps.feedback.create(pending))) {
    // A concurrent request claimed the session first: its row wins.
    const winner = await deps.feedback.findBySession(
      "flashcards",
      session.id,
      ownerId,
    );
    return winner
      ? ok(winner)
      : err(
          new DomainError(
            STUDY_ENGINE_ERROR.SESSION_NOT_FOUND,
            input.sessionId,
          ),
        );
  }

  const fail = async (generationId: string | null) => {
    const failed = failSessionFeedback(pending, generationId, deps.clock.now());
    await deps.feedback.update(failed);
    return ok(failed);
  };

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
    generated = await deps.ai.generateStructured(
      {
        purpose: "session_feedback",
        pageId: session.pageId,
        promptVersion: SESSION_FEEDBACK_PROMPT_VERSION,
        ...prompt,
      },
      ownerId,
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
  await deps.feedback.update(done);
  return ok(done);
}
