import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { createAiServerApi } from "@/modules/ai";
import { createNotebooksServerApi } from "@/modules/notebooks";
import {
  createRecallReviewRecorder,
  type DueCutoff,
} from "@/modules/study-engine";
import { serverEnv } from "@/shared/config/env.server";
import { getDb } from "@/shared/db/client";
import { systemClock } from "@/shared/kernel/clock";
import { createId } from "@/shared/kernel/id";
import {
  type EvaluateRecallSessionDeps,
  evaluateRecallSession,
} from "./application";
import {
  createDrizzleRecallRepositories,
  DrizzleRecallSessionUnitOfWork,
} from "./infrastructure";

// Runs a session's asynchronous evaluation after the Server Action
// answered (Phase 6 T6, ADR 0003: no queue). No "use server" here: this is
// a helper, not a client-reachable entry point. `after()` runs within the
// function budget of the route that hosts the action: the recall session
// page declares `maxDuration = 300`.

// Adapters are built per run, like the actions: serverless functions are
// short-lived, so no module-level singletons. Every repository works on the
// pool directly (no transaction around model calls); study-engine records
// the SM-2 reviews in its own unit of work.
// `dueCutoff` is the owner's per-day "due" bound (scheduling's
// getCurrentDueCutoff), resolved by the scheduling action inside the
// request: the deferred run has no session to read the profile zone from.
export function buildEvaluationDeps(
  dueCutoff: DueCutoff,
): EvaluateRecallSessionDeps {
  const db = getDb();
  const env = serverEnv();
  const ids = { next: createId };
  const ai = createAiServerApi({ env, db, clock: systemClock, ids });
  const { sessions, answers, questions } = createDrizzleRecallRepositories(db);
  return {
    // The final status write locks the session in its own transaction.
    uow: new DrizzleRecallSessionUnitOfWork(db),
    sessions,
    answers,
    questions,
    pages: createNotebooksServerApi({ db, clock: systemClock }),
    ai,
    limiter: ai.evaluationLimiter,
    reviews: createRecallReviewRecorder({ db, ids }),
    clock: systemClock,
    dueCutoff,
    tokenCap: env.AI_PAGE_TOKEN_CAP,
    onError: (error) => Sentry.captureException(error),
  };
}

// Schedules evaluateRecallSession after the response. Never throws and
// never blocks the action: every failure goes to Sentry, and the answers it
// could not resolve stay pending (a later run takes them over) or failed
// ("Reintentar").
export function scheduleRecallEvaluation(
  sessionId: string,
  ownerId: string,
  dueCutoff: DueCutoff,
  build: (
    dueCutoff: DueCutoff,
  ) => EvaluateRecallSessionDeps = buildEvaluationDeps,
): void {
  after(async () => {
    try {
      const result = await evaluateRecallSession(
        { sessionId },
        build(dueCutoff),
        ownerId,
      );
      if (!result.ok) Sentry.captureException(result.error);
    } catch (error) {
      Sentry.captureException(error);
    }
  });
}
