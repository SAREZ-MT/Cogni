import {
  type AiGeneration,
  AiGenerationFailedError,
  buildExamSessionFeedbackPrompt,
  EXAM_SESSION_FEEDBACK_PROMPT_VERSION,
  type FailedExamQuestion,
  type GenerateStructuredInput,
  type GenerationRateLimiter,
  sessionFeedbackOutput,
  truncateToTokenCap,
} from "@/modules/ai";
import type { PageTextReader } from "@/modules/notebooks";
import {
  completeSessionFeedback,
  failSessionFeedback,
  newSessionFeedback,
  type SessionFeedback,
  type SessionFeedbackRepository,
} from "@/modules/study-engine";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { EXAM_ERROR } from "../domain/errors";
import type { ExamQuestion } from "../domain/exam-question";
import type { ExamAnswer, ExamSession } from "../domain/exam-session";
import { decideFeedback } from "../domain/feedback-policy";
import {
  type ExamSessionUnitOfWork,
  loadSessionQuestions,
} from "./exam-session-work";

export interface RequestExamFeedbackDeps {
  // Read-only here: the session, its answers and questions, and the page's
  // finished sessions.
  uow: ExamSessionUnitOfWork;
  feedback: SessionFeedbackRepository;
  pages: PageTextReader;
  // Only `peek`: feedback respects the student's daily AI limit but does
  // not spend a generation of it (same as flashcards).
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
  ids: { next(): string };
  // The page token cap (AI_PAGE_TOKEN_CAP) the page text is cut to.
  tokenCap: number;
  // Overrides FEEDBACK_AI_TIMEOUT_MS (tests).
  aiTimeoutMs?: number;
}

// The feedback shown for an exam session. `reused`: the session is a pass
// after an earlier pass, so `feedback` is that earlier pass's stored row
// (another session's id); no AI call is made and no row is stored for this
// session (user decision 2026-10-05). Otherwise `feedback` is the
// session's own row.
export interface ExamFeedback {
  feedback: SessionFeedback;
  reused: boolean;
}

// Longest wait for the AI answer (flashcards' value): past it the student
// gets the calm "no feedback" note instead of a spinner. The call itself is
// not cancelled (the provider port has no abort signal).
export const FEEDBACK_AI_TIMEOUT_MS = 25_000;

// A "pending" row untouched for this long belongs to a request that died
// or hung: the next request may reclaim it. Well above the AI timeout.
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

interface ExamFeedbackSources {
  session: ExamSession;
  questions: ExamQuestion[];
  answers: ExamAnswer[];
  // The page's sessions finished before this one, oldest first.
  earlier: ExamSession[];
}

function sessionNotFound(sessionId: string) {
  return err(
    new DomainError(
      EXAM_ERROR.SESSION_NOT_FOUND,
      `exam session ${sessionId} not found`,
    ),
  );
}

async function loadSources(
  sessionId: string,
  deps: Pick<RequestExamFeedbackDeps, "uow">,
  ownerId: string,
): Promise<Result<ExamFeedbackSources, DomainError>> {
  return deps.uow.run(async (repos) => {
    const session = await repos.sessions.findById(sessionId, ownerId);
    if (!session) return sessionNotFound(sessionId);
    if (session.finishedAt === null) {
      return err(
        new DomainError(
          EXAM_ERROR.FEEDBACK_SESSION_OPEN,
          "Feedback is given once the exam session is finished",
        ),
      );
    }
    const finished = await repos.sessions.listFinishedByPage(
      session.pageId,
      ownerId,
    );
    // listFinishedByPage is ordered by (finishedAt, id): the sessions
    // before this one are the earlier attempts decideFeedback reads.
    const index = finished.findIndex((s) => s.id === session.id);
    return ok({
      session,
      questions: await loadSessionQuestions(session, repos),
      answers: await repos.answers.listBySession(session.id, ownerId),
      earlier: index === -1 ? [] : finished.slice(0, index),
    });
  });
}

type StoredFeedback =
  | { kind: "own"; feedback: SessionFeedback }
  | { kind: "reused"; feedback: SessionFeedback }
  | { kind: "generate" };

// The feedback a session already has, without calling the AI: its own row,
// or (a pass after an earlier pass) the feedback that earlier pass shows.
// A pass that reused feedback stores no row, so a chain of passes carries
// the last generated feedback forward; a pass whose own generation failed
// or is still pending carries none (decideFeedback then generates).
async function storedFeedback(
  sources: ExamFeedbackSources,
  feedbackRepo: SessionFeedbackRepository,
  ownerId: string,
): Promise<StoredFeedback> {
  const { session, earlier } = sources;
  const own = await feedbackRepo.findBySession("exam", session.id, ownerId);
  if (own) return { kind: "own", feedback: own };

  const shown = new Map<string, SessionFeedback>();
  let carried: SessionFeedback | null = null;
  for (const previous of earlier) {
    if (previous.passed !== true) continue;
    const row = await feedbackRepo.findBySession("exam", previous.id, ownerId);
    if (row) carried = row.status === "done" ? row : null;
    if (carried) shown.set(previous.id, carried);
  }

  const decision = decideFeedback({
    attemptPassed: session.passed === true,
    previousSessions: earlier.map((previous) => ({
      sessionId: previous.id,
      passed: previous.passed,
      finishedAt: previous.finishedAt,
      feedbackId: shown.get(previous.id)?.id ?? null,
    })),
  });
  if (decision.kind === "reuse") {
    const reused = shown.get(decision.sessionId);
    if (reused) return { kind: "reused", feedback: reused };
  }
  return { kind: "generate" };
}

// Failed questions in the exam's order, with the chosen and correct
// options as text (the prompt caps how many are sent).
function failedQuestions(sources: ExamFeedbackSources): FailedExamQuestion[] {
  const byQuestion = new Map(sources.answers.map((a) => [a.questionId, a]));
  return sources.questions.flatMap((question) => {
    const answer = byQuestion.get(question.id);
    if (!answer || answer.isCorrect) return [];
    return [
      {
        concept: question.concept,
        stem: question.stem,
        chosenAnswer: question.options[answer.selectedIndex] ?? "",
        correctAnswer: question.options[question.correctIndex] ?? "",
        explanation: question.explanation,
      },
    ];
  });
}

function isReclaimable(feedback: SessionFeedback, now: Date): boolean {
  return (
    feedback.status === "pending" &&
    now.getTime() - feedback.updatedAt.getTime() > STALE_PENDING_MS
  );
}

// The feedback an exam session already has, read-only (the results page):
// null when none was generated yet (or it should be generated now).
export async function readExamFeedback(
  input: { sessionId: string },
  deps: Pick<RequestExamFeedbackDeps, "uow" | "feedback">,
  ownerId: string,
): Promise<Result<ExamFeedback | null, DomainError>> {
  const sources = await loadSources(input.sessionId, deps, ownerId);
  if (!sources.ok) return sources;
  const stored = await storedFeedback(sources.value, deps.feedback, ownerId);
  return ok(
    stored.kind === "generate"
      ? null
      : { feedback: stored.feedback, reused: stored.kind === "reused" },
  );
}

// AI feedback at the end of an exam (documento-maestro §3.3: the AI
// explains the failed questions using the page's content; §8.4
// session_feedback). Policy (user decision 2026-10-05, decideFeedback): a
// failed exam and the first pass get new feedback; a pass after an earlier
// pass reuses that pass's stored feedback with no AI call; a failed exam
// after a pass gets new feedback. Generation follows flashcards'
// requestSessionFeedback: one row per session claimed once (unique
// session_kind, session_id), a stale pending row reclaimed, settled only
// while pending, an AI timeout, and every failure stored as "failed" and
// returned as ok: it never blocks closing the session, which it never
// writes.
export async function requestExamFeedback(
  input: { sessionId: string },
  deps: RequestExamFeedbackDeps,
  ownerId: string,
): Promise<Result<ExamFeedback, DomainError>> {
  const loaded = await loadSources(input.sessionId, deps, ownerId);
  if (!loaded.ok) return loaded;
  const sources = loaded.value;
  const { session } = sources;

  const stored = await storedFeedback(sources, deps.feedback, ownerId);
  if (stored.kind === "reused") {
    return ok({ feedback: stored.feedback, reused: true });
  }
  if (
    stored.kind === "own" &&
    !isReclaimable(stored.feedback, deps.clock.now())
  ) {
    return ok({ feedback: stored.feedback, reused: false });
  }

  // Claim: insert a new pending row, or take over a stale pending one.
  const now = deps.clock.now();
  let pending: SessionFeedback | null = null;
  if (stored.kind === "own") {
    pending = await deps.feedback.reclaimStalePending(
      "exam",
      session.id,
      ownerId,
      new Date(now.getTime() - STALE_PENDING_MS),
      now,
    );
  } else {
    const fresh = newSessionFeedback({
      id: deps.ids.next(),
      ownerId,
      sessionKind: "exam",
      sessionId: session.id,
      now,
    });
    if (await deps.feedback.create(fresh)) pending = fresh;
  }
  if (!pending) {
    // A concurrent request claimed or reclaimed the row first: its row wins.
    const held = await deps.feedback.findBySession("exam", session.id, ownerId);
    return held
      ? ok({ feedback: held, reused: false })
      : sessionNotFound(session.id);
  }
  const claimed = pending;

  // Writes `next` only while the row is still pending; when the write did
  // not apply or its outcome is unknown, a settled stored row wins and a
  // still-pending one gives null.
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
        "exam",
        session.id,
        ownerId,
      );
      return current && current.status !== "pending" ? current : null;
    } catch {
      return null;
    }
  };

  // Best effort: when even this write fails the row stays pending and a
  // later request reclaims it once stale.
  const fail = async (
    generationId: string | null,
  ): Promise<Result<ExamFeedback, DomainError>> => {
    const failed = failSessionFeedback(claimed, generationId, deps.clock.now());
    return ok({ feedback: (await settle(failed)) ?? failed, reused: false });
  };

  try {
    const limit = await deps.limiter.peek(ownerId);
    if (!limit.allowed) return fail(null);

    let generated: Awaited<ReturnType<typeof deps.ai.generateStructured>>;
    try {
      const page = await deps.pages.getPageText(session.pageId, ownerId);
      const prompt = buildExamSessionFeedbackPrompt({
        pageTitle: page.ok ? page.value.title : "",
        pageText: page.ok
          ? truncateToTokenCap(page.value.plainText, deps.tokenCap).text
          : "",
        total: session.total ?? sources.answers.length,
        correct: session.correct ?? 0,
        passed: session.passed === true,
        failed: failedQuestions(sources),
      });
      generated = await withTimeout(
        deps.ai.generateStructured(
          {
            purpose: "session_feedback",
            pageId: session.pageId,
            promptVersion: EXAM_SESSION_FEEDBACK_PROMPT_VERSION,
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
      claimed,
      parsed.data,
      generation.id,
      deps.clock.now(),
    );
    const settled = await settle(done);
    // Still pending: the done write did not commit, so fail the row.
    return settled
      ? ok({ feedback: settled, reused: false })
      : fail(generation.id);
  } catch {
    return fail(null);
  }
}
