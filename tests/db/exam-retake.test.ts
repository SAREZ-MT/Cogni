import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type {
  AiGeneration,
  GenerateStructuredInput,
  GenerationRateLimit,
  GenerationRateLimiter,
} from "@/modules/ai";
import {
  answerExamQuestion,
  completeExamSession,
  createExamQuestion,
  readExamSession,
  type StartExamRetakeDeps,
  startExamRetake,
  startExamSession,
} from "@/modules/exams/application";
import {
  DrizzleExamPageStateRepository,
  DrizzleExamSessionUnitOfWork,
  DrizzleExamUnitOfWork,
} from "@/modules/exams/infrastructure";
import type { PageTextReader } from "@/modules/notebooks";
import {
  aiGenerations,
  examQuestions,
  examSessions,
  notebooks,
  pages,
  profiles,
} from "@/shared/db/schema";
import { createFixedClock } from "@/shared/kernel/clock";
import { ok } from "@/shared/kernel/result";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Reviews are due per local day (UTC here): due before the next midnight.
function utcDayCutoff(now: Date): Date {
  const day = 86_400_000;
  return new Date((Math.floor(now.getTime() / day) + 1) * day);
}

// A retake against Postgres (§7.5): the variants, the retired wordings and
// the retake session commit in one transaction (or not at all), and the
// retake is finished like any exam.
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const owner = await createTestOwner("exam-retake-owner");
  const notebookId = randomUUID();
  let nextPagePosition = 1;
  const CREATED = new Date("2026-10-04T08:00:00.000Z");
  const STARTED = new Date("2026-10-05T09:00:00.000Z");
  const RETAKE = new Date("2026-10-06T09:00:00.000Z");
  const ids: { next(): string } = { next: () => randomUUID() };
  const pageReader: PageTextReader = {
    getPageText: async () =>
      ok({ title: "Página", plainText: "La mitocondria produce ATP." }),
  };

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
    title: "Cuaderno de repeticiones",
    position: 1,
  });

  class CountingLimiter implements GenerationRateLimiter {
    checks = 0;
    async check(): Promise<GenerationRateLimit> {
      this.checks += 1;
      return { allowed: true, remaining: 5, resetAt: RETAKE };
    }
    async peek(): Promise<GenerationRateLimit> {
      return { allowed: true, remaining: 6, resetAt: RETAKE };
    }
  }

  // Stores a real ai_generations row (FK of the variants) and answers one
  // fresh wording per root listed in the prompt.
  const ai: StartExamRetakeDeps["ai"] = {
    async generateStructured(input: GenerateStructuredInput) {
      const id = randomUUID();
      await db.insert(aiGenerations).values({
        id,
        ownerId: owner.id,
        pageId: input.pageId ?? null,
        purpose: "generate_exam_variants",
        provider: "fake",
        model: "fake-model",
        promptVersion: input.promptVersion,
        status: "done",
      });
      const roots = [...input.prompt.matchAll(/^Root (\S+) \[/gm)].map(
        (m) => m[1] as string,
      );
      return ok({
        object: {
          variants: roots.map((rootId) => ({
            forRootId: rootId,
            stem: `¿Reformulada ${rootId}?`,
            options: ["Correcta", "Dos", "Tres", "Cuatro"],
            correctIndex: 0,
            explanation: "Porque sí.",
          })),
        },
        generation: { id } as AiGeneration,
      });
    },
  };

  async function pageWithQuestions(): Promise<string> {
    const pageId = randomUUID();
    await db.insert(pages).values({
      id: pageId,
      ownerId: owner.id,
      notebookId,
      title: `Página ${pageId}`,
      content: { type: "doc", content: [] },
      position: nextPagePosition++,
    });
    for (let n = 1; n <= 10; n += 1) {
      const created = await createExamQuestion(
        {
          pageId,
          stem: `¿Pregunta ${n} de ${pageId}?`,
          options: ["Correcta", "Dos", "Tres", "Cuatro"],
          correctIndex: 0,
          explanation: "Porque sí.",
          concept: `Concepto ${n}`,
        },
        {
          pages: pageReader,
          uow: new DrizzleExamUnitOfWork(db),
          clock: createFixedClock(new Date(CREATED.getTime() + n)),
          ids,
        },
        owner.id,
      );
      if (!created.ok) throw created.error;
    }
    return pageId;
  }

  // Answers every question of a session, the first `wrong` wrong, and
  // finishes it.
  async function takeSession(sessionId: string, wrong: number, at: Date) {
    const uow = new DrizzleExamSessionUnitOfWork(db, ids);
    const detail = await readExamSession({ sessionId }, { uow }, owner.id);
    if (!detail.ok) throw detail.error;
    for (const [n, { question }] of detail.value.questions.entries()) {
      const answered = await answerExamQuestion(
        {
          sessionId,
          questionId: question.id,
          selectedIndex: n < wrong ? 2 : 0,
        },
        { uow, clock: createFixedClock(at) },
        owner.id,
      );
      if (!answered.ok) throw answered.error;
    }
    const done = await completeExamSession(
      { sessionId },
      {
        uow,
        clock: createFixedClock(new Date(at.getTime() + 60_000)),
        dueCutoff: utcDayCutoff,
      },
      owner.id,
    );
    if (!done.ok) throw done.error;
    return detail.value.questions.map(({ question }) => question);
  }

  async function failedPage() {
    const pageId = await pageWithQuestions();
    const started = await startExamSession(
      { pageId, requestedCount: 10 },
      {
        pages: pageReader,
        uow: new DrizzleExamSessionUnitOfWork(db, ids),
        clock: createFixedClock(STARTED),
        dueCutoff: utcDayCutoff,
        ids,
      },
      owner.id,
    );
    if (!started.ok) throw started.error;
    const shown = await takeSession(started.value.session.id, 4, STARTED);
    return { pageId, failedSessionId: started.value.session.id, shown };
  }

  function retake(
    pageId: string,
    limiter: GenerationRateLimiter,
    sessionIds = ids,
  ) {
    return startExamRetake(
      { pageId, requestedCount: 10 },
      {
        pages: pageReader,
        limiter,
        ai,
        uow: new DrizzleExamSessionUnitOfWork(db, ids),
        clock: createFixedClock(RETAKE),
        dueCutoff: utcDayCutoff,
        ids: sessionIds,
        tokenCap: 12_000,
      },
      owner.id,
    );
  }

  describe("exam retake on Postgres", { timeout: 240_000 }, () => {
    it("stores the variants, retires the failed wordings and creates the retake in one transaction; a passing retake clears the page", async () => {
      const { pageId, failedSessionId, shown } = await failedPage();
      const failed = shown.slice(0, 4);
      const limiter = new CountingLimiter();

      const result = await retake(pageId, limiter);
      if (!result.ok) throw result.error;
      if (result.value.kind !== "started") throw new Error("not started");
      const { session } = result.value;
      expect(limiter.checks).toBe(1);

      const [row] = await db
        .select()
        .from(examSessions)
        .where(eq(examSessions.id, session.id));
      expect(row).toMatchObject({
        isRetake: true,
        retakeOfSessionId: failedSessionId,
        finishedAt: null,
      });
      expect(row?.questionIds).toEqual(session.questionIds);

      const variants = await db
        .select()
        .from(examQuestions)
        .where(inArray(examQuestions.id, session.questionIds.slice(0, 4)));
      const byId = new Map(variants.map((v) => [v.id, v]));
      // The variants come first, one per failed root (in the page state's
      // order), each replacing the wording shown in the failed exam.
      const failedByRoot = new Map(failed.map((q) => [q.rootId, q]));
      expect(new Set(variants.map((v) => v.rootId))).toEqual(
        new Set(failedByRoot.keys()),
      );
      session.questionIds.slice(0, 4).forEach((id) => {
        const previous = failedByRoot.get(byId.get(id)?.rootId ?? "");
        expect(byId.get(id)).toMatchObject({
          origin: "ai_variant",
          rootId: previous?.rootId,
          variantOf: previous?.id,
          concept: previous?.concept,
          retiredAt: null,
        });
        expect(byId.get(id)?.generationId).not.toBeNull();
      });
      const previous = await db
        .select()
        .from(examQuestions)
        .where(
          inArray(
            examQuestions.id,
            failed.map((q) => q.id),
          ),
        );
      expect(
        previous.every((q) => q.retiredAt?.getTime() === RETAKE.getTime()),
      ).toBe(true);

      // Resuming makes no AI call and no second session.
      const again = await retake(pageId, limiter);
      if (!again.ok) throw again.error;
      if (again.value.kind !== "started") throw new Error("not started");
      expect(again.value).toMatchObject({ resumed: true });
      expect(again.value.session.id).toBe(session.id);
      expect(limiter.checks).toBe(1);

      await takeSession(session.id, 0, new Date(RETAKE.getTime() + 1000));
      expect(
        await new DrizzleExamPageStateRepository(db).get(pageId, owner.id),
      ).toMatchObject({
        retakePending: false,
        failedRootIds: [],
        lastPassedSessionId: session.id,
      });
    });

    it("rolls the variants and the retirements back when the session cannot be created, and consumes no unit", async () => {
      const { pageId, failedSessionId, shown } = await failedPage();
      const limiter = new CountingLimiter();
      // Ids are drawn for the 4 variants first, then for the session: the
      // 5th collides with the failed session, so the insert fails after
      // the variants and the retirements were written.
      let drawn = 0;
      const colliding = {
        next: () => {
          drawn += 1;
          return drawn === 5 ? failedSessionId : randomUUID();
        },
      };
      await expect(retake(pageId, limiter, colliding)).rejects.toThrow();
      expect(limiter.checks).toBe(0);

      const rows = await db
        .select()
        .from(examQuestions)
        .where(eq(examQuestions.pageId, pageId));
      expect(rows).toHaveLength(10);
      expect(rows.every((q) => q.origin !== "ai_variant")).toBe(true);
      expect(rows.every((q) => q.retiredAt === null)).toBe(true);
      const sessions = await db
        .select()
        .from(examSessions)
        .where(eq(examSessions.pageId, pageId));
      expect(sessions.map((s) => s.id)).toEqual([failedSessionId]);
      expect(shown).toHaveLength(10);
    });

    it("clears the pending retake when every failed question was retired under the page lock, without an AI call or a new session", async () => {
      const { pageId, shown } = await failedPage();
      await db
        .update(examQuestions)
        .set({ retiredAt: STARTED })
        .where(
          inArray(
            examQuestions.id,
            shown.slice(0, 4).map((q) => q.id),
          ),
        );
      const limiter = new CountingLimiter();
      const result = await retake(pageId, limiter);
      expect(result).toEqual(ok({ kind: "cleared" }));
      expect(limiter.checks).toBe(0);
      expect(
        await new DrizzleExamPageStateRepository(db).get(pageId, owner.id),
      ).toMatchObject({
        retakePending: false,
        failedRootIds: [],
        lastPassedSessionId: null,
      });
      const sessions = await db
        .select()
        .from(examSessions)
        .where(eq(examSessions.pageId, pageId));
      expect(sessions).toHaveLength(1);
    });
  });
}
