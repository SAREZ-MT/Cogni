import { describe, expect, it } from "vitest";
import {
  newRecallAnswer,
  type RecallAnswer,
  skippedEvaluation,
} from "../../domain/recall-answer";
import type { RecallAnswerRepository } from "../../domain/recall-answer-repository";
import {
  newRecallQuestion,
  type RecallQuestion,
} from "../../domain/recall-question";
import type { RecallQuestionRepository } from "../../domain/recall-question-repository";
import {
  newRecallSession,
  type RecallSession,
} from "../../domain/recall-session";
import type { RecallSessionRepository } from "../../domain/recall-session-repository";

export interface RecallRepositories {
  readonly questions: RecallQuestionRepository;
  readonly sessions: RecallSessionRepository;
  readonly answers: RecallAnswerRepository;
}

export interface RecallRepositoriesContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  readonly newId: () => string;
  // A fresh page owned by `ownerId`. Async so the DB runner can insert the
  // real page row (FK).
  readonly newPageId: () => Promise<string>;
  // A fresh AI generation of `ownerId` (FK of AI questions and answers).
  readonly newGenerationId: () => Promise<string>;
}

export interface RecallRepositoriesContractOptions {
  createRepositories(): RecallRepositories;
  context: () => RecallRepositoriesContractContext;
}

const T0 = new Date("2026-10-06T09:00:00.000Z");
const T1 = new Date("2026-10-06T09:10:00.000Z");
const T2 = new Date("2026-10-06T09:20:00.000Z");
const T3 = new Date("2026-10-06T09:30:00.000Z");

function unwrap<T>(
  result: { ok: true; value: T } | { ok: false; error: Error },
) {
  if (!result.ok) throw result.error;
  return result.value;
}

// Shared by the in-memory fakes (unit suite) and the Drizzle adapters
// (`pnpm test:db`); both must satisfy it. Assertions only look at the
// fixtures each test creates: the DB runner shares cogni-dev.
export function runRecallRepositoriesContract(
  options: RecallRepositoriesContractOptions,
): void {
  const question = (
    ctx: RecallRepositoriesContractContext,
    pageId: string,
    overrides: {
      now?: Date;
      ownerId?: string;
      generationId?: string;
      id?: string;
    } = {},
  ): RecallQuestion =>
    unwrap(
      newRecallQuestion(
        {
          id: overrides.id ?? ctx.newId(),
          ownerId: overrides.ownerId ?? ctx.ownerId,
          pageId,
          prompt: `Explica el concepto ${ctx.newId()}`,
          rubric: {
            keyConcepts: ["mitocondria", "ATP"],
            acceptableAnswerSummary: "La mitocondria produce ATP.",
          },
          origin: overrides.generationId ? "ai" : "manual",
          generationId: overrides.generationId ?? null,
        },
        overrides.now ?? T0,
      ),
    );

  const session = (
    ctx: RecallRepositoriesContractContext,
    pageId: string,
    overrides: { startedAt?: Date; ownerId?: string } = {},
  ): RecallSession =>
    newRecallSession(
      {
        id: ctx.newId(),
        ownerId: overrides.ownerId ?? ctx.ownerId,
        pageId,
      },
      overrides.startedAt ?? T0,
    );

  const answer = (
    ctx: RecallRepositoriesContractContext,
    s: RecallSession,
    q: RecallQuestion,
    overrides: { text?: string; selfRating?: number; now?: Date } = {},
  ): RecallAnswer =>
    unwrap(
      newRecallAnswer(
        {
          id: ctx.newId(),
          ownerId: s.ownerId,
          sessionId: s.id,
          questionId: q.id,
          answerText: overrides.text ?? "Produce energía.",
          selfRating: overrides.selfRating ?? 3,
        },
        overrides.now ?? T1,
      ),
    );

  // A page with one session and `count` questions, all stored.
  async function seeded(
    ctx: RecallRepositoriesContractContext,
    repos: RecallRepositories,
    count = 1,
  ) {
    const pageId = await ctx.newPageId();
    const questions = Array.from({ length: count }, () =>
      question(ctx, pageId),
    );
    await repos.questions.saveMany(questions);
    const s = session(ctx, pageId);
    await repos.sessions.create(s);
    return { pageId, questions, session: s };
  }

  describe("RecallQuestionRepository contract", () => {
    it("saveMany then listByIds returns the questions as given", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const ai = question(ctx, pageId, {
        generationId: await ctx.newGenerationId(),
      });
      const manual = question(ctx, pageId, { now: T1 });
      await questions.saveMany([ai, manual]);
      expect(
        await questions.listByIds([manual.id, ai.id], ctx.ownerId),
      ).toEqual([ai, manual]);
    });

    it("saveMany of nothing writes nothing", async () => {
      const { questions } = options.createRepositories();
      await expect(questions.saveMany([])).resolves.toBeUndefined();
    });

    it("rejects a duplicate id inside the batch and writes nothing", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const a = question(ctx, pageId);
      const b = question(ctx, pageId);
      await expect(questions.saveMany([a, b, { ...a }])).rejects.toThrow();
      expect(await questions.listByIds([a.id, b.id], ctx.ownerId)).toEqual([]);
    });

    it("rejects an already stored id and writes nothing of the batch", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const stored = question(ctx, pageId);
      await questions.saveMany([stored]);
      const fresh = question(ctx, pageId);
      await expect(questions.saveMany([fresh, stored])).rejects.toThrow();
      expect(await questions.listByIds([fresh.id], ctx.ownerId)).toEqual([]);
    });

    it("listActiveByPage returns the page's active questions, oldest first", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const otherPage = await ctx.newPageId();
      const late = question(ctx, pageId, { now: T2 });
      const early = question(ctx, pageId, { now: T0 });
      const archived = {
        ...question(ctx, pageId, { now: T1 }),
        archivedAt: T2,
      };
      await questions.saveMany([late, early, archived]);
      await questions.saveMany([question(ctx, otherPage)]);
      expect(await questions.listActiveByPage(pageId, ctx.ownerId)).toEqual([
        early,
        late,
      ]);
    });

    it("listActiveByPage breaks createdAt ties by id", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const tied = [question(ctx, pageId), question(ctx, pageId)];
      await questions.saveMany(tied);
      const sorted = [...tied].sort((a, b) => (a.id < b.id ? -1 : 1));
      expect(await questions.listActiveByPage(pageId, ctx.ownerId)).toEqual(
        sorted,
      );
    });

    it("hides the questions from another owner", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const q = question(ctx, pageId);
      await questions.saveMany([q]);
      expect(
        await questions.listActiveByPage(pageId, ctx.otherOwnerId),
      ).toEqual([]);
      expect(await questions.listByIds([q.id], ctx.otherOwnerId)).toEqual([]);
    });

    it("listByIds keeps archived questions and leaves unknown ids out", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const archived = { ...question(ctx, pageId), archivedAt: T1 };
      await questions.saveMany([archived]);
      expect(
        await questions.listByIds([archived.id, ctx.newId()], ctx.ownerId),
      ).toEqual([archived]);
      expect(await questions.listByIds([], ctx.ownerId)).toEqual([]);
    });
  });

  describe("RecallSessionRepository contract", () => {
    it("create then findById and lockById return the session", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const s = session(ctx, await ctx.newPageId());
      await sessions.create(s);
      expect(await sessions.findById(s.id, ctx.ownerId)).toEqual(s);
      expect(await sessions.lockById(s.id, ctx.ownerId)).toEqual(s);
    });

    it("rejects a duplicate id", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const s = session(ctx, await ctx.newPageId());
      await sessions.create(s);
      await expect(sessions.create(s)).rejects.toThrow();
    });

    it("hides a session from another owner", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const s = session(ctx, await ctx.newPageId());
      await sessions.create(s);
      expect(await sessions.findById(s.id, ctx.otherOwnerId)).toBeNull();
      expect(await sessions.lockById(s.id, ctx.otherOwnerId)).toBeNull();
      expect(await sessions.finish(s.id, ctx.otherOwnerId, T1)).toBeNull();
      expect(
        await sessions.setEvaluationStatus(s.id, ctx.otherOwnerId, "done", T1),
      ).toBeNull();
      expect(await sessions.findById(s.id, ctx.ownerId)).toEqual(s);
    });

    it("finish closes an open session once", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const s = session(ctx, await ctx.newPageId());
      await sessions.create(s);
      const finished = { ...s, finishedAt: T1 };
      expect(await sessions.finish(s.id, ctx.ownerId, T1)).toEqual(finished);
      expect(await sessions.finish(s.id, ctx.ownerId, T2)).toEqual(finished);
      expect(await sessions.findById(s.id, ctx.ownerId)).toEqual(finished);
    });

    it("setEvaluationStatus stores the status of a finished session", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const s = session(ctx, await ctx.newPageId());
      await sessions.create(s);
      await sessions.finish(s.id, ctx.ownerId, T1);
      expect(
        await sessions.setEvaluationStatus(s.id, ctx.ownerId, "partial", T2),
      ).toEqual({ ...s, finishedAt: T1, evaluationStatus: "partial" });
      expect(
        await sessions.setEvaluationStatus(s.id, ctx.ownerId, "done", T3),
      ).toEqual({ ...s, finishedAt: T1, evaluationStatus: "done" });
    });

    it("rejects done or partial on an open session", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const s = session(ctx, await ctx.newPageId());
      await sessions.create(s);
      await expect(
        sessions.setEvaluationStatus(s.id, ctx.ownerId, "done", T1),
      ).rejects.toThrow();
      expect(await sessions.findById(s.id, ctx.ownerId)).toEqual(s);
      expect(
        await sessions.setEvaluationStatus(s.id, ctx.ownerId, "pending", T1),
      ).toEqual(s);
    });

    it("listByPage returns the page's latest sessions first, limited", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const first = session(ctx, pageId, { startedAt: T0 });
      const second = session(ctx, pageId, { startedAt: T1 });
      const third = session(ctx, pageId, { startedAt: T2 });
      for (const s of [second, third, first]) await sessions.create(s);
      await sessions.create(session(ctx, await ctx.newPageId()));
      await sessions.create(
        session(ctx, pageId, { ownerId: ctx.otherOwnerId, startedAt: T3 }),
      );
      expect(await sessions.listByPage(pageId, ctx.ownerId, 2)).toEqual([
        third,
        second,
      ]);
      expect(await sessions.listByPage(pageId, ctx.ownerId, 10)).toEqual([
        third,
        second,
        first,
      ]);
    });

    it("listByPage breaks startedAt ties by id, descending", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const tied = [session(ctx, pageId), session(ctx, pageId)];
      for (const s of tied) await sessions.create(s);
      const sorted = [...tied].sort((a, b) => (a.id < b.id ? 1 : -1));
      expect(await sessions.listByPage(pageId, ctx.ownerId, 10)).toEqual(
        sorted,
      );
    });

    it("listRecentByOwner returns the owner's latest sessions on any page", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      // Far in the future so fixtures of other tests (or other files on the
      // shared DB) never sort before these.
      const future = new Date("2999-01-01T00:00:00.000Z");
      const later = new Date("2999-01-02T00:00:00.000Z");
      const a = session(ctx, await ctx.newPageId(), { startedAt: future });
      const b = session(ctx, await ctx.newPageId(), { startedAt: later });
      await sessions.create(a);
      await sessions.create(b);
      await sessions.create(
        session(ctx, await ctx.newPageId(), {
          ownerId: ctx.otherOwnerId,
          startedAt: new Date("2999-02-01T00:00:00.000Z"),
        }),
      );
      expect(await sessions.listRecentByOwner(ctx.ownerId, 2)).toEqual([b, a]);
    });
  });

  describe("RecallAnswerRepository contract", () => {
    it("upsert stores a pending answer and listBySession returns it", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos);
      const a = answer(ctx, s, questions[0]);
      expect(await repos.answers.upsert(a)).toEqual(a);
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([a]);
    });

    it("upsert replaces the text and rating of the question's answer, keeping its id", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos);
      const first = answer(ctx, s, questions[0], { selfRating: 1 });
      await repos.answers.upsert(first);
      const second = answer(ctx, s, questions[0], {
        text: "Respira la célula.",
        selfRating: 4,
        now: T2,
      });
      const expected = {
        ...first,
        answerText: "Respira la célula.",
        selfRating: 4,
        updatedAt: T2,
      };
      expect(await repos.answers.upsert(second)).toEqual(expected);
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([
        expected,
      ]);
    });

    it("upsert leaves a claimed or resolved answer unchanged", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos, 2);
      const claimed = answer(ctx, s, questions[0]);
      const resolved = answer(ctx, s, questions[1]);
      await repos.answers.upsert(claimed);
      await repos.answers.upsert(resolved);
      const [, toResolve] = await repos.answers.claimPendingForEvaluation(
        s.id,
        ctx.ownerId,
        T1,
        T2,
      );
      await repos.answers.saveEvaluation(
        toResolve.id,
        ctx.ownerId,
        { status: "failed", aiEvaluation: { error: "x" }, generationId: null },
        T2,
      );
      const before = await repos.answers.listBySession(s.id, ctx.ownerId);
      for (const q of questions) {
        await repos.answers.upsert(
          answer(ctx, s, q, { text: "Otra", selfRating: 5, now: T3 }),
        );
      }
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual(
        before,
      );
    });

    it("upsert rejects a session of another owner", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, pageId } = await seeded(ctx, repos);
      const foreign = session(ctx, pageId, { ownerId: ctx.otherOwnerId });
      await repos.sessions.create(foreign);
      const a = { ...answer(ctx, foreign, questions[0]), ownerId: ctx.ownerId };
      await expect(repos.answers.upsert(a)).rejects.toThrow();
      expect(
        await repos.answers.listBySession(foreign.id, ctx.otherOwnerId),
      ).toEqual([]);
    });

    it("upsert rejects a question of another owner", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { pageId, session: s } = await seeded(ctx, repos);
      const foreign = question(ctx, pageId, { ownerId: ctx.otherOwnerId });
      await repos.questions.saveMany([foreign]);
      await expect(
        repos.answers.upsert(answer(ctx, s, foreign)),
      ).rejects.toThrow();
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([]);
    });

    it("upsert rejects a question on another page than the session", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { session: s } = await seeded(ctx, repos);
      const elsewhere = question(ctx, await ctx.newPageId());
      await repos.questions.saveMany([elsewhere]);
      await expect(
        repos.answers.upsert(answer(ctx, s, elsewhere)),
      ).rejects.toThrow();
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([]);
    });

    it("upsert rejects an unknown question", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { pageId, session: s } = await seeded(ctx, repos);
      const unknown = question(ctx, pageId);
      await expect(
        repos.answers.upsert(answer(ctx, s, unknown)),
      ).rejects.toThrow();
    });

    it("listBySession returns the answers oldest first and hides them from another owner", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos, 2);
      const late = answer(ctx, s, questions[0], { now: T2 });
      const early = answer(ctx, s, questions[1], { now: T1 });
      await repos.answers.upsert(late);
      await repos.answers.upsert(early);
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([
        early,
        late,
      ]);
      expect(await repos.answers.listBySession(s.id, ctx.otherOwnerId)).toEqual(
        [],
      );
    });

    it("claimPendingForEvaluation claims each pending answer once until the claim is stale", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos, 2);
      const a = answer(ctx, s, questions[0], { now: T0 });
      const b = answer(ctx, s, questions[1], { now: T1 });
      await repos.answers.upsert(a);
      await repos.answers.upsert(b);

      const claimed = await repos.answers.claimPendingForEvaluation(
        s.id,
        ctx.ownerId,
        T0,
        T2,
      );
      expect(claimed).toEqual([
        { ...a, updatedAt: T2 },
        { ...b, updatedAt: T2 },
      ]);
      // The claim stores the bumped updatedAt: getRecallSessionResults'
      // evaluationRunNeeded reads it to tell a live run from a dead one.
      expect(
        (await repos.answers.listBySession(s.id, ctx.ownerId)).map(
          (row) => row.updatedAt,
        ),
      ).toEqual([T2, T2]);
      // A live claim (stamped T2, not before T1) is not taken again.
      expect(
        await repos.answers.claimPendingForEvaluation(
          s.id,
          ctx.ownerId,
          T1,
          T3,
        ),
      ).toEqual([]);
      // Once T2 is before the stale bound, the run is presumed dead.
      expect(
        (
          await repos.answers.claimPendingForEvaluation(
            s.id,
            ctx.ownerId,
            T3,
            T3,
          )
        ).map((row) => row.id),
      ).toEqual([a.id, b.id]);
    });

    it("claimPendingForEvaluation skips resolved answers and other owners", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos, 2);
      const resolved = answer(ctx, s, questions[0]);
      const pending = answer(ctx, s, questions[1]);
      await repos.answers.upsert(resolved);
      await repos.answers.saveEvaluation(
        resolved.id,
        ctx.ownerId,
        {
          status: "done",
          aiEvaluation: skippedEvaluation(),
          aiScore: 0,
          combinedQuality: 1,
          generationId: null,
        },
        T1,
      );
      await repos.answers.upsert(pending);
      expect(
        await repos.answers.claimPendingForEvaluation(
          s.id,
          ctx.otherOwnerId,
          T1,
          T2,
        ),
      ).toEqual([]);
      expect(
        (
          await repos.answers.claimPendingForEvaluation(
            s.id,
            ctx.ownerId,
            T1,
            T2,
          )
        ).map((row) => row.id),
      ).toEqual([pending.id]);
    });

    it("saveEvaluation stores a done evaluation once", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos);
      const a = answer(ctx, s, questions[0], { selfRating: 4 });
      await repos.answers.upsert(a);
      const generationId = await ctx.newGenerationId();
      const raw = { score: 3, justification: "Falta el ATP." };
      const done = {
        ...a,
        evaluationStatus: "done" as const,
        aiEvaluation: raw,
        aiScore: 3,
        combinedQuality: 3,
        generationId,
        updatedAt: T2,
      };
      expect(
        await repos.answers.saveEvaluation(
          a.id,
          ctx.ownerId,
          {
            status: "done",
            aiEvaluation: raw,
            aiScore: 3,
            combinedQuality: 3,
            generationId,
          },
          T2,
        ),
      ).toEqual(done);
      expect(
        await repos.answers.saveEvaluation(
          a.id,
          ctx.ownerId,
          { status: "failed", aiEvaluation: {}, generationId: null },
          T3,
        ),
      ).toEqual(done);
    });

    it("saveEvaluation keeps the raw failed attempt without inventing a score", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos);
      const a = answer(ctx, s, questions[0]);
      await repos.answers.upsert(a);
      const raw = { error: "provider_unavailable", attempts: 2 };
      expect(
        await repos.answers.saveEvaluation(
          a.id,
          ctx.ownerId,
          { status: "failed", aiEvaluation: raw, generationId: null },
          T2,
        ),
      ).toEqual({
        ...a,
        evaluationStatus: "failed",
        aiEvaluation: raw,
        updatedAt: T2,
      });
    });

    it.each([
      [6, 3],
      [3, -1],
      [2.5, 3],
    ])("saveEvaluation rejects ai score %s with combined %s", async (aiScore, combinedQuality) => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos);
      const a = answer(ctx, s, questions[0]);
      await repos.answers.upsert(a);
      await expect(
        repos.answers.saveEvaluation(
          a.id,
          ctx.ownerId,
          {
            status: "done",
            aiEvaluation: {},
            aiScore,
            combinedQuality,
            generationId: null,
          },
          T2,
        ),
      ).rejects.toThrow();
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([a]);
    });

    it("saveEvaluation and markDisagreed ignore another owner's answer", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos);
      const a = answer(ctx, s, questions[0]);
      await repos.answers.upsert(a);
      expect(
        await repos.answers.saveEvaluation(
          a.id,
          ctx.otherOwnerId,
          { status: "failed", aiEvaluation: {}, generationId: null },
          T2,
        ),
      ).toBeNull();
      expect(
        await repos.answers.markDisagreed(a.id, ctx.otherOwnerId, T2),
      ).toBeNull();
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([a]);
    });

    it("requeueFailed moves failed answers back to claimable pending, keeping the raw attempt", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos, 2);
      const failed = answer(ctx, s, questions[0]);
      const done = answer(ctx, s, questions[1]);
      await repos.answers.upsert(failed);
      await repos.answers.upsert(done);
      await repos.answers.claimPendingForEvaluation(s.id, ctx.ownerId, T0, T1);
      const raw = { error: "timeout" };
      await repos.answers.saveEvaluation(
        failed.id,
        ctx.ownerId,
        { status: "failed", aiEvaluation: raw, generationId: null },
        T1,
      );
      await repos.answers.saveEvaluation(
        done.id,
        ctx.ownerId,
        {
          status: "done",
          aiEvaluation: {},
          aiScore: 5,
          combinedQuality: 4,
          generationId: null,
        },
        T1,
      );

      expect(
        await repos.answers.requeueFailed(s.id, ctx.otherOwnerId, T2),
      ).toBe(0);
      expect(await repos.answers.requeueFailed(s.id, ctx.ownerId, T2)).toBe(1);
      // The released claim (T1) does not hold back a fresh run.
      expect(
        await repos.answers.claimPendingForEvaluation(
          s.id,
          ctx.ownerId,
          T0,
          T3,
        ),
      ).toEqual([
        {
          ...failed,
          evaluationStatus: "pending",
          aiEvaluation: raw,
          updatedAt: T3,
        },
      ]);
    });

    it("markDisagreed records the disagreement without touching the score", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const { questions, session: s } = await seeded(ctx, repos);
      const a = answer(ctx, s, questions[0], { selfRating: 5 });
      await repos.answers.upsert(a);
      await repos.answers.saveEvaluation(
        a.id,
        ctx.ownerId,
        {
          status: "done",
          aiEvaluation: {},
          aiScore: 1,
          combinedQuality: 3,
          generationId: null,
        },
        T1,
      );
      const disagreed = {
        ...a,
        evaluationStatus: "done" as const,
        aiEvaluation: {},
        aiScore: 1,
        combinedQuality: 3,
        disagreed: true,
        updatedAt: T2,
      };
      expect(await repos.answers.markDisagreed(a.id, ctx.ownerId, T2)).toEqual(
        disagreed,
      );
      expect(await repos.answers.markDisagreed(a.id, ctx.ownerId, T3)).toEqual(
        disagreed,
      );
    });
  });
}
