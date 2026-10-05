import { describe, expect, it } from "vitest";
import type { ExamAnswerRepository } from "../../domain/exam-answer-repository";
import type { ExamPageStateRepository } from "../../domain/exam-page-state-repository";
import {
  type ExamQuestion,
  newExamQuestion,
  newVariant,
  retireExamQuestion,
} from "../../domain/exam-question";
import type { ExamQuestionRepository } from "../../domain/exam-question-repository";
import {
  type ExamAnswer,
  type ExamSession,
  finishExamSession,
  newExamSession,
} from "../../domain/exam-session";
import type { ExamSessionRepository } from "../../domain/exam-session-repository";

export interface ExamRepositories {
  readonly questions: ExamQuestionRepository;
  readonly sessions: ExamSessionRepository;
  readonly answers: ExamAnswerRepository;
  readonly pageStates: ExamPageStateRepository;
}

export interface ExamRepositoriesContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  readonly newId: () => string;
  // A fresh page owned by `ownerId`. Async so the DB runner can insert the
  // real page row (FK).
  readonly newPageId: () => Promise<string>;
  // A fresh AI generation of `ownerId` (FK of AI questions and variants).
  readonly newGenerationId: () => Promise<string>;
}

export interface ExamRepositoriesContractOptions {
  createRepositories(): ExamRepositories;
  context: () => ExamRepositoriesContractContext;
}

const T0 = new Date("2026-10-05T09:00:00.000Z");
const T1 = new Date("2026-10-05T09:10:00.000Z");
const T2 = new Date("2026-10-05T09:20:00.000Z");

function unwrap<T>(
  result: { ok: true; value: T } | { ok: false; error: Error },
) {
  if (!result.ok) throw result.error;
  return result.value;
}

// Shared by the in-memory fakes (unit suite) and the Drizzle adapters
// (`pnpm test:db`); both must satisfy it. Assertions only look at the
// fixtures each test creates: the DB runner shares cogni-dev.
export function runExamRepositoriesContract(
  options: ExamRepositoriesContractOptions,
): void {
  const question = (
    ctx: ExamRepositoriesContractContext,
    pageId: string,
    overrides: { stem?: string; now?: Date; ownerId?: string } = {},
  ): ExamQuestion =>
    unwrap(
      newExamQuestion(
        {
          id: ctx.newId(),
          ownerId: overrides.ownerId ?? ctx.ownerId,
          pageId,
          stem: overrides.stem ?? `¿Pregunta ${ctx.newId()}?`,
          options: ["Uno", "Dos", "Tres", "Cuatro"],
          correctIndex: 2,
          explanation: "Porque sí.",
          concept: "Concepto",
          origin: "manual",
          generationId: null,
        },
        overrides.now ?? T0,
      ),
    );

  const session = (
    ctx: ExamRepositoriesContractContext,
    pageId: string,
    retakeOfSessionId: string | null = null,
  ): ExamSession =>
    unwrap(
      newExamSession(
        {
          id: ctx.newId(),
          ownerId: ctx.ownerId,
          pageId,
          requestedCount: 10,
          retakeOfSessionId,
        },
        T0,
      ),
    );

  const answer = (
    sessionId: string,
    q: ExamQuestion,
    isCorrect: boolean,
    answeredAt: Date = T1,
  ): ExamAnswer => ({
    sessionId,
    questionId: q.id,
    rootId: q.rootId,
    selectedIndex: isCorrect ? q.correctIndex : (q.correctIndex + 1) % 4,
    isCorrect,
    answeredAt,
  });

  describe("ExamQuestionRepository contract", () => {
    it("save then findById returns the question", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const q = question(ctx, await ctx.newPageId());
      await questions.save(q);
      expect(await questions.findById(q.id, ctx.ownerId)).toEqual(q);
    });

    it("rejects a duplicate id", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const q = question(ctx, await ctx.newPageId());
      await questions.save(q);
      await expect(questions.save(q)).rejects.toThrow();
    });

    it("keeps an AI variant's lineage and generation", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const root = question(ctx, pageId);
      await questions.save(root);
      const variant = unwrap(
        newVariant(
          root,
          [root],
          {
            id: ctx.newId(),
            stem: "¿Otra redacción?",
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            explanation: "",
            generationId: await ctx.newGenerationId(),
          },
          T1,
        ),
      );
      await questions.save(variant);
      expect(await questions.findById(variant.id, ctx.ownerId)).toEqual(
        variant,
      );
    });

    it("never shows another owner's question", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const q = question(ctx, pageId);
      await questions.save(q);
      expect(await questions.findById(q.id, ctx.otherOwnerId)).toBeNull();
      expect(
        await questions.listActiveByPage(pageId, ctx.otherOwnerId),
      ).toEqual([]);
      expect(await questions.listLineage(q.rootId, ctx.otherOwnerId)).toEqual(
        [],
      );
      expect(await questions.retire(q.id, ctx.otherOwnerId, T1)).toBeNull();
      expect(
        await questions.update({ ...q, ownerId: ctx.otherOwnerId, stem: "x" }),
      ).toBeNull();
      expect(await questions.findById(q.id, ctx.ownerId)).toEqual(q);
    });

    it("update edits the content in place and keeps identity and lineage", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const q = question(ctx, await ctx.newPageId());
      await questions.save(q);
      const edited: ExamQuestion = {
        ...q,
        stem: "¿Nueva redacción?",
        options: ["W", "X", "Y", "Z"],
        correctIndex: 3,
        explanation: "Nueva explicación.",
        concept: "Nuevo concepto",
        updatedAt: T1,
      };
      expect(await questions.update(edited)).toEqual(edited);
      expect(await questions.findById(q.id, ctx.ownerId)).toEqual(edited);
    });

    it("listActiveByPage excludes retired questions and other pages, oldest first", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const later = question(ctx, pageId, { now: T1 });
      const earlier = question(ctx, pageId, { now: T0 });
      const retired = question(ctx, pageId, { now: T0 });
      await questions.save(later);
      await questions.save(earlier);
      await questions.save(retired);
      await questions.save(question(ctx, await ctx.newPageId()));
      await questions.retire(retired.id, ctx.ownerId, T2);
      expect(await questions.listActiveByPage(pageId, ctx.ownerId)).toEqual([
        earlier,
        later,
      ]);
    });

    it("listLineage returns the whole lineage, retired questions included", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const root = question(ctx, pageId);
      await questions.save(root);
      await questions.save(question(ctx, pageId));
      const variant = unwrap(
        newVariant(
          root,
          [root],
          {
            id: ctx.newId(),
            stem: "¿Variante?",
            options: ["A", "B", "C", "D"],
            correctIndex: 1,
            explanation: "",
            generationId: await ctx.newGenerationId(),
          },
          T1,
        ),
      );
      await questions.save(variant);
      const retiredRoot = await questions.retire(root.id, ctx.ownerId, T1);
      expect(await questions.listLineage(root.id, ctx.ownerId)).toEqual([
        retiredRoot,
        variant,
      ]);
    });

    it("retire is idempotent and keeps the first retiredAt", async () => {
      const ctx = options.context();
      const { questions } = options.createRepositories();
      const q = question(ctx, await ctx.newPageId());
      await questions.save(q);
      const expected = unwrap(retireExamQuestion(q, T1));
      expect(await questions.retire(q.id, ctx.ownerId, T1)).toEqual(expected);
      expect(await questions.retire(q.id, ctx.ownerId, T2)).toEqual(expected);
    });
  });

  describe("ExamSessionRepository contract", () => {
    it("create then findById returns the open session", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const s = session(ctx, await ctx.newPageId());
      await sessions.create(s);
      expect(await sessions.findById(s.id, ctx.ownerId)).toEqual(s);
      expect(await sessions.findById(s.id, ctx.otherOwnerId)).toBeNull();
    });

    it("keeps a retake's link to the failed session", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const failed = session(ctx, pageId);
      await sessions.create(failed);
      const retake = session(ctx, pageId, failed.id);
      await sessions.create(retake);
      expect(await sessions.findById(retake.id, ctx.ownerId)).toEqual(retake);
    });

    it("finish stores the result once; a second finish changes nothing", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const pageId = await ctx.newPageId();
      const s = session(ctx, pageId);
      await repos.sessions.create(s);
      const q = question(ctx, pageId);
      const finished = unwrap(
        finishExamSession(s, [answer(s.id, q, true)], T1),
      );
      expect(await repos.sessions.finish(finished)).toEqual(finished);
      const again = { ...finished, finishedAt: T2, correct: 0, score: 0 };
      expect(await repos.sessions.finish(again)).toEqual(finished);
      expect(await repos.sessions.findById(s.id, ctx.ownerId)).toEqual(
        finished,
      );
    });

    it("finish never touches another owner's session", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const s = session(ctx, pageId);
      await sessions.create(s);
      const q = question(ctx, pageId);
      const finished = unwrap(
        finishExamSession(s, [answer(s.id, q, true)], T1),
      );
      expect(
        await sessions.finish({ ...finished, ownerId: ctx.otherOwnerId }),
      ).toBeNull();
      expect(await sessions.findById(s.id, ctx.ownerId)).toEqual(s);
    });

    it("listFinishedByPage lists the page's finished sessions, oldest finish first", async () => {
      const ctx = options.context();
      const { sessions } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const q = question(ctx, pageId);
      const first = session(ctx, pageId);
      const second = session(ctx, pageId);
      const open = session(ctx, pageId);
      for (const s of [first, second, open]) await sessions.create(s);
      await sessions.create(session(ctx, await ctx.newPageId()));
      const secondDone = unwrap(
        finishExamSession(second, [answer(second.id, q, false)], T2),
      );
      const firstDone = unwrap(
        finishExamSession(first, [answer(first.id, q, true)], T1),
      );
      await sessions.finish(secondDone);
      await sessions.finish(firstDone);
      expect(await sessions.listFinishedByPage(pageId, ctx.ownerId)).toEqual([
        firstDone,
        secondDone,
      ]);
      expect(
        await sessions.listFinishedByPage(pageId, ctx.otherOwnerId),
      ).toEqual([]);
    });
  });

  describe("ExamAnswerRepository contract", () => {
    async function seeded(ctx: ExamRepositoriesContractContext) {
      const repos = options.createRepositories();
      const pageId = await ctx.newPageId();
      const s = session(ctx, pageId);
      await repos.sessions.create(s);
      const a = question(ctx, pageId);
      const b = question(ctx, pageId);
      await repos.questions.save(a);
      await repos.questions.save(b);
      return { repos, pageId, s, a, b };
    }

    it("saveMany then listBySession returns the answers oldest first", async () => {
      const ctx = options.context();
      const { repos, s, a, b } = await seeded(ctx);
      const late = answer(s.id, a, true, T2);
      const early = answer(s.id, b, false, T1);
      await repos.answers.saveMany([late, early], ctx.ownerId);
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([
        early,
        late,
      ]);
      expect(await repos.answers.listBySession(s.id, ctx.otherOwnerId)).toEqual(
        [],
      );
    });

    it("refuses another owner's session and writes nothing", async () => {
      const ctx = options.context();
      const { repos, s, a } = await seeded(ctx);
      await expect(
        repos.answers.saveMany([answer(s.id, a, true)], ctx.otherOwnerId),
      ).rejects.toThrow();
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([]);
    });

    it("refuses two answers to one question, writing none of the batch", async () => {
      const ctx = options.context();
      const { repos, s, a, b } = await seeded(ctx);
      await expect(
        repos.answers.saveMany(
          [
            answer(s.id, b, true),
            answer(s.id, a, true),
            answer(s.id, a, false),
          ],
          ctx.ownerId,
        ),
      ).rejects.toThrow();
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([]);
    });

    it("refuses an answer to a question already answered in an earlier batch", async () => {
      const ctx = options.context();
      const { repos, s, a } = await seeded(ctx);
      const first = answer(s.id, a, true);
      await repos.answers.saveMany([first], ctx.ownerId);
      await expect(
        repos.answers.saveMany([answer(s.id, a, false, T2)], ctx.ownerId),
      ).rejects.toThrow();
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([
        first,
      ]);
    });

    it("refuses two answers to one root (a question and its variant)", async () => {
      const ctx = options.context();
      const { repos, s, a } = await seeded(ctx);
      const variant = unwrap(
        newVariant(
          a,
          [a],
          {
            id: ctx.newId(),
            stem: "¿Variante de la raíz?",
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            explanation: "",
            generationId: await ctx.newGenerationId(),
          },
          T1,
        ),
      );
      await repos.questions.save(variant);
      await expect(
        repos.answers.saveMany(
          [answer(s.id, a, true), answer(s.id, variant, false)],
          ctx.ownerId,
        ),
      ).rejects.toThrow();
      expect(await repos.answers.listBySession(s.id, ctx.ownerId)).toEqual([]);
    });

    it("lets two sessions answer the same question", async () => {
      const ctx = options.context();
      const { repos, pageId, s, a } = await seeded(ctx);
      const other = session(ctx, pageId);
      await repos.sessions.create(other);
      await repos.answers.saveMany([answer(s.id, a, true)], ctx.ownerId);
      await repos.answers.saveMany([answer(other.id, a, false)], ctx.ownerId);
      expect(await repos.answers.listBySession(other.id, ctx.ownerId)).toEqual([
        answer(other.id, a, false),
      ]);
    });
  });

  describe("ExamPageStateRepository contract", () => {
    it("get is null before the first upsert", async () => {
      const ctx = options.context();
      const { pageStates } = options.createRepositories();
      expect(
        await pageStates.get(await ctx.newPageId(), ctx.ownerId),
      ).toBeNull();
    });

    it("upsert inserts then overwrites the page's state", async () => {
      const ctx = options.context();
      const repos = options.createRepositories();
      const pageId = await ctx.newPageId();
      const passed = session(ctx, pageId);
      await repos.sessions.create(passed);
      const failedState = {
        pageId,
        ownerId: ctx.ownerId,
        retakePending: true,
        failedRootIds: [ctx.newId(), ctx.newId()],
        lastPassedSessionId: null,
      };
      await repos.pageStates.upsert(failedState);
      expect(await repos.pageStates.get(pageId, ctx.ownerId)).toEqual(
        failedState,
      );
      const passedState = {
        ...failedState,
        retakePending: false,
        failedRootIds: [],
        lastPassedSessionId: passed.id,
      };
      await repos.pageStates.upsert(passedState);
      expect(await repos.pageStates.get(pageId, ctx.ownerId)).toEqual(
        passedState,
      );
    });

    it("never reads or overwrites another owner's state", async () => {
      const ctx = options.context();
      const { pageStates } = options.createRepositories();
      const pageId = await ctx.newPageId();
      const state = {
        pageId,
        ownerId: ctx.ownerId,
        retakePending: true,
        failedRootIds: [ctx.newId()],
        lastPassedSessionId: null,
      };
      await pageStates.upsert(state);
      expect(await pageStates.get(pageId, ctx.otherOwnerId)).toBeNull();
      await pageStates.upsert({
        ...state,
        ownerId: ctx.otherOwnerId,
        retakePending: false,
        failedRootIds: [],
      });
      expect(await pageStates.get(pageId, ctx.ownerId)).toEqual(state);
    });
  });
}
