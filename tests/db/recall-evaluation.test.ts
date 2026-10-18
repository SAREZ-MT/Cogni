import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  type EvaluateRecallSessionDeps,
  evaluateRecallSession,
} from "@/modules/active-recall/application/evaluate-recall-session";
import {
  newRecallAnswer,
  skippedEvaluation,
} from "@/modules/active-recall/domain/recall-answer";
import { newRecallQuestion } from "@/modules/active-recall/domain/recall-question";
import { newRecallSession } from "@/modules/active-recall/domain/recall-session";
import {
  createDrizzleRecallRepositories,
  DrizzleRecallSessionUnitOfWork,
} from "@/modules/active-recall/infrastructure";
import type { AiGeneration, GenerateStructuredInput } from "@/modules/ai";
import { createInMemoryGenerationLimiter } from "@/modules/ai/infrastructure";
import {
  createRecallReviewRecorder,
  createStudyItemRepository,
} from "@/modules/study-engine";
import { newStudyItem } from "@/modules/study-engine/domain/study-item";
import {
  notebooks,
  pages,
  profiles,
  recallAnswers,
  recallSessions,
  reviewLogs,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Reviews are due per local day (UTC here): due before the next midnight.
function utcDayCutoff(now: Date): Date {
  const day = 86_400_000;
  return new Date((Math.floor(now.getTime() / day) + 1) * day);
}

// The asynchronous recall evaluation against the real database (Phase 6
// T6): every answer keeps its raw evaluation (model output, failed attempt
// or skipped record), review_logs are written for done answers only, a
// retry evaluates the failed answer once, and two concurrent runs never
// evaluate the same answer twice (claim, T2 follow-up).
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("recall-evaluation-owner");
  const notebookId = randomUUID();
  const pageId = randomUUID();
  const NOW = new Date("2026-10-07T10:00:00.000Z");

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values({ id: owner.id });
  await db.insert(notebooks).values({
    id: notebookId,
    ownerId: owner.id,
    title: "Cuaderno de evaluación",
    position: 1,
  });
  await db.insert(pages).values({
    id: pageId,
    ownerId: owner.id,
    notebookId,
    title: "Mitocondria",
    content: { type: "doc", content: [] },
    position: 1,
  });

  const repos = createDrizzleRecallRepositories(db);
  const items = createStudyItemRepository(db);

  // Three questions with their study items (new, so due).
  async function seedSession(texts: string[]) {
    const questionIds: string[] = [];
    for (const [i] of texts.entries()) {
      const id = randomUUID();
      const question = newRecallQuestion(
        {
          id,
          ownerId: owner.id,
          pageId,
          prompt: `¿Pregunta ${i}?`,
          rubric: { keyConcepts: ["ATP"], acceptableAnswerSummary: "ATP." },
          origin: "manual",
          generationId: null,
        },
        NOW,
      );
      if (!question.ok) throw question.error;
      await repos.questions.saveMany([question.value]);
      await items.save(
        newStudyItem({
          id: randomUUID(),
          ownerId: owner.id,
          pageId,
          kind: "recall_question",
          sourceId: id,
          now: NOW,
        }),
      );
      questionIds.push(id);
    }
    const sessionId = randomUUID();
    await repos.sessions.create(
      newRecallSession({ id: sessionId, ownerId: owner.id, pageId }, NOW),
    );
    for (const [i, text] of texts.entries()) {
      const answer = newRecallAnswer(
        {
          id: randomUUID(),
          ownerId: owner.id,
          sessionId,
          questionId: questionIds[i] as string,
          answerText: text,
          selfRating: 4,
        },
        new Date(NOW.getTime() + i),
      );
      if (!answer.ok) throw answer.error;
      await repos.answers.upsert(answer.value);
    }
    await repos.sessions.finish(
      sessionId,
      owner.id,
      new Date(NOW.getTime() + 60_000),
    );
    return { sessionId, questionIds };
  }

  // Answers holding "FALLA" fail while `failing` is on; the rest score 4.
  function stubAi(state: { failing: boolean; calls: number }) {
    return {
      async generateStructured(input: GenerateStructuredInput) {
        state.calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (state.failing && input.prompt.includes("FALLA")) {
          // No audited attempt here (no ai_generations row to reference).
          return err(
            new DomainError("AI_NO_PROVIDER_AVAILABLE", "no provider"),
          );
        }
        return ok({
          object: {
            score: 4,
            presentConcepts: ["ATP"],
            missingConcepts: [],
            misconceptions: [],
            justification: "Bien.",
          },
          generation: { id: null } as unknown as AiGeneration,
        });
      },
    };
  }

  function deps(state: {
    failing: boolean;
    calls: number;
  }): EvaluateRecallSessionDeps {
    const clock = createFixedClock(new Date(NOW.getTime() + 120_000));
    return {
      ...repos,
      uow: new DrizzleRecallSessionUnitOfWork(db),
      pages: {
        getPageText: async () =>
          ok({
            title: "Mitocondria",
            plainText: "La mitocondria produce ATP.",
          }),
      },
      ai: stubAi(state),
      limiter: createInMemoryGenerationLimiter({ limit: 60, clock }),
      reviews: createRecallReviewRecorder({ db, ids: { next: randomUUID } }),
      clock,
      dueCutoff: utcDayCutoff,
      tokenCap: 12_000,
    };
  }

  async function logsOf(sessionId: string) {
    return db
      .select()
      .from(reviewLogs)
      .where(
        and(
          eq(reviewLogs.sessionId, sessionId),
          eq(reviewLogs.sessionKind, "recall"),
        ),
      );
  }

  describe("recall evaluation on the database", { timeout: 30_000 }, () => {
    it("keeps every raw evaluation, logs done answers only and retries the failed one once", async () => {
      const { sessionId } = await seedSession(["Produce ATP", "", "FALLA"]);
      const state = { failing: true, calls: 0 };

      const first = await evaluateRecallSession(
        { sessionId },
        deps(state),
        owner.id,
      );

      expect(first.ok && first.value.session.evaluationStatus).toBe("partial");
      const rows = await db
        .select()
        .from(recallAnswers)
        .where(eq(recallAnswers.sessionId, sessionId))
        .orderBy(recallAnswers.createdAt);
      expect(rows.map((r) => r.evaluationStatus)).toEqual([
        "done",
        "done",
        "failed",
      ]);
      expect(rows[0]?.aiEvaluation).toMatchObject({ score: 4 });
      expect(rows[1]?.aiEvaluation).toEqual(skippedEvaluation());
      expect(rows[2]?.aiEvaluation).toMatchObject({
        source: "failed",
        code: "AI_NO_PROVIDER_AVAILABLE",
      });
      expect(rows.every((r) => r.evaluationClaimedAt === null)).toBe(true);
      expect(await logsOf(sessionId)).toHaveLength(2);

      await repos.answers.requeueFailed(sessionId, owner.id, NOW);
      state.failing = false;
      const retried = await evaluateRecallSession(
        { sessionId },
        deps(state),
        owner.id,
      );

      expect(retried.ok && retried.value.session.evaluationStatus).toBe("done");
      expect(state.calls).toBe(3);
      expect(await logsOf(sessionId)).toHaveLength(3);
      const [session] = await db
        .select()
        .from(recallSessions)
        .where(eq(recallSessions.id, sessionId));
      expect(session?.evaluationStatus).toBe("done");
    });

    it("never evaluates an answer twice when two runs race", async () => {
      const { sessionId } = await seedSession([
        "ATP uno",
        "ATP dos",
        "ATP tres",
      ]);
      const state = { failing: false, calls: 0 };

      const [a, b] = await Promise.all([
        evaluateRecallSession({ sessionId }, deps(state), owner.id),
        evaluateRecallSession({ sessionId }, deps(state), owner.id),
      ]);

      expect(a.ok && b.ok).toBe(true);
      expect(state.calls).toBe(3);
      expect(await logsOf(sessionId)).toHaveLength(3);
      const rows = await db
        .select()
        .from(recallAnswers)
        .where(eq(recallAnswers.sessionId, sessionId));
      expect(rows.every((r) => r.evaluationStatus === "done")).toBe(true);
    });
  });
}
