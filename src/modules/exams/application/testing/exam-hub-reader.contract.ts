import { describe, expect, it } from "vitest";
import type { ExamHubReader } from "../../domain/exam-hub-reader";
import {
  type ExamQuestion,
  newExamQuestion,
  newVariant,
} from "../../domain/exam-question";
import {
  type ExamSession,
  finishExamSession,
  initialExamPageState,
  newExamSession,
} from "../../domain/exam-session";
import type { ExamRepositories } from "./exam-repositories.contract";

export interface ExamHubPageFixture {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  notebookColor: string | null;
}

export interface ExamHubReaderContractContext {
  readonly ownerId: string;
  readonly otherOwnerId: string;
  readonly newId: () => string;
  // A fresh page (in a fresh notebook) of `ownerId` (default: the owner).
  readonly newPage: (input?: {
    ownerId?: string;
    pageTitle?: string;
    notebookTitle?: string;
  }) => Promise<ExamHubPageFixture>;
  readonly archivePage: (page: ExamHubPageFixture) => Promise<void>;
  readonly archiveNotebook: (page: ExamHubPageFixture) => Promise<void>;
  // A fresh AI generation of the owner (FK of AI variants).
  readonly newGenerationId: () => Promise<string>;
}

export interface ExamHubReaderContractOptions {
  // The reader and the repositories that write what it reads.
  createFixture(): { reader: ExamHubReader; repositories: ExamRepositories };
  context: () => ExamHubReaderContractContext;
}

const T0 = new Date("2026-10-05T09:00:00.000Z");
const T1 = new Date("2026-10-05T09:10:00.000Z");
const T2 = new Date("2026-10-06T09:10:00.000Z");

function unwrap<T>(
  result: { ok: true; value: T } | { ok: false; error: Error },
) {
  if (!result.ok) throw result.error;
  return result.value;
}

// Shared by the in-memory fake (unit suite) and the Drizzle reader
// (`pnpm test:db`). Assertions only look at the pages each test creates:
// the DB runner shares cogni-dev.
export function runExamHubReaderContract(
  options: ExamHubReaderContractOptions,
): void {
  const question = (
    ctx: ExamHubReaderContractContext,
    page: ExamHubPageFixture,
    ownerId: string = ctx.ownerId,
  ): ExamQuestion =>
    unwrap(
      newExamQuestion(
        {
          id: ctx.newId(),
          ownerId,
          pageId: page.pageId,
          stem: `¿Pregunta ${ctx.newId()}?`,
          options: ["Uno", "Dos", "Tres", "Cuatro"],
          correctIndex: 1,
          explanation: "Porque sí.",
          concept: "Concepto",
          origin: "manual",
          generationId: null,
        },
        T0,
      ),
    );

  // A session of the page finished at `finishedAt` with `correct` of the
  // given questions answered right (the rest wrong).
  const finishedSession = (
    ctx: ExamHubReaderContractContext,
    page: ExamHubPageFixture,
    questions: readonly ExamQuestion[],
    correct: number,
    finishedAt: Date,
  ): { open: ExamSession; finished: ExamSession } => {
    const open = unwrap(
      newExamSession(
        {
          id: ctx.newId(),
          ownerId: ctx.ownerId,
          pageId: page.pageId,
          requestedCount: 10,
          retakeOfSessionId: null,
          questionIds: questions.map((q) => q.id),
        },
        T0,
      ),
    );
    const finished = unwrap(
      finishExamSession(
        open,
        questions.map((q, index) => ({
          sessionId: open.id,
          questionId: q.id,
          rootId: q.rootId,
          selectedIndex: index < correct ? q.correctIndex : 0,
          isCorrect: index < correct,
          answeredAt: finishedAt,
        })),
        finishedAt,
      ),
    );
    return { open, finished };
  };

  async function saveFinished(
    repositories: ExamRepositories,
    session: { open: ExamSession; finished: ExamSession },
  ) {
    await repositories.sessions.create(session.open);
    await repositories.sessions.finish(session.finished);
  }

  describe("ExamHubReader contract", () => {
    it("lists a page with active questions, its notebook and no exam history yet", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const page = await ctx.newPage();
      await repositories.questions.save(question(ctx, page));
      await repositories.questions.save(question(ctx, page));

      const rows = await reader.listExamPages(ctx.ownerId);

      expect(rows.find((row) => row.pageId === page.pageId)).toEqual({
        ...page,
        activeQuestionCount: 2,
        attempts: 0,
        lastSession: null,
        // Phase 8 H17: the best finished score and the newest active
        // question (the flat hub's "Mejor nota" and recency).
        bestScore: null,
        latestQuestionAt: T0,
        retakePending: false,
        failedRootIds: [],
      });
    });

    it("reports the best whole-percent score of the page's finished exams", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const page = await ctx.newPage();
      const questions = [
        question(ctx, page),
        question(ctx, page),
        question(ctx, page),
      ];
      for (const q of questions) await repositories.questions.save(q);
      // 2 of 3 earlier (66 %), 1 of 3 later (33 %): best is not the last.
      await saveFinished(
        repositories,
        finishedSession(ctx, page, questions, 2, T1),
      );
      await saveFinished(
        repositories,
        finishedSession(ctx, page, questions, 1, T2),
      );

      const row = (await reader.listExamPages(ctx.ownerId)).find(
        (candidate) => candidate.pageId === page.pageId,
      );

      expect(row?.bestScore).toBe(66);
      expect(row?.lastSession?.correct).toBe(1);
    });

    it("counts roots with an active question, never retired ones or each variant", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const page = await ctx.newPage();
      const kept = question(ctx, page);
      const reformulated = question(ctx, page);
      const retired = question(ctx, page);
      for (const q of [kept, reformulated, retired]) {
        await repositories.questions.save(q);
      }
      await repositories.questions.retire(retired.id, ctx.ownerId, T1);
      const variant = unwrap(
        newVariant(
          reformulated,
          [reformulated],
          {
            id: ctx.newId(),
            stem: `¿Otra redacción ${ctx.newId()}?`,
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            explanation: "Otra.",
            generationId: await ctx.newGenerationId(),
          },
          T1,
        ),
      );
      await repositories.questions.save(variant);
      // A retake retires the previous wording once its variant exists.
      await repositories.questions.retire(reformulated.id, ctx.ownerId, T1);

      const rows = await reader.listExamPages(ctx.ownerId);

      expect(
        rows.find((row) => row.pageId === page.pageId)?.activeQuestionCount,
      ).toBe(2);
    });

    it("leaves out pages whose questions are all retired and pages without questions", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const retiredPage = await ctx.newPage();
      const emptyPage = await ctx.newPage();
      const q = question(ctx, retiredPage);
      await repositories.questions.save(q);
      await repositories.questions.retire(q.id, ctx.ownerId, T1);

      const ids = (await reader.listExamPages(ctx.ownerId)).map(
        (row) => row.pageId,
      );

      expect(ids).not.toContain(retiredPage.pageId);
      expect(ids).not.toContain(emptyPage.pageId);
    });

    it("counts finished sessions only and reports the latest finished one", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const page = await ctx.newPage();
      const questions = [question(ctx, page), question(ctx, page)];
      for (const q of questions) await repositories.questions.save(q);
      const later = finishedSession(ctx, page, questions, 2, T2);
      const earlier = finishedSession(ctx, page, questions, 1, T1);
      await saveFinished(repositories, later);
      await saveFinished(repositories, earlier);
      await repositories.sessions.create(
        finishedSession(ctx, page, questions, 0, T2).open,
      );

      const row = (await reader.listExamPages(ctx.ownerId)).find(
        (candidate) => candidate.pageId === page.pageId,
      );

      expect(row?.attempts).toBe(2);
      expect(row?.lastSession).toEqual({
        finishedAt: T2,
        total: 2,
        correct: 2,
        passed: true,
      });
    });

    it("reports a pending retake from the page state", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const page = await ctx.newPage();
      const q = question(ctx, page);
      await repositories.questions.save(q);
      await repositories.pageStates.upsert({
        ...initialExamPageState(page.pageId, ctx.ownerId),
        retakePending: true,
        failedRootIds: [q.rootId],
      });

      const row = (await reader.listExamPages(ctx.ownerId)).find(
        (candidate) => candidate.pageId === page.pageId,
      );

      expect(row?.retakePending).toBe(true);
      expect(row?.failedRootIds).toEqual([q.rootId]);
    });

    it("never lists another owner's pages", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const foreign = await ctx.newPage({ ownerId: ctx.otherOwnerId });
      await repositories.questions.save(
        question(ctx, foreign, ctx.otherOwnerId),
      );

      const ids = (await reader.listExamPages(ctx.ownerId)).map(
        (row) => row.pageId,
      );

      expect(ids).not.toContain(foreign.pageId);
    });

    it("leaves out archived pages and pages of archived notebooks", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const archivedPage = await ctx.newPage();
      const inArchivedNotebook = await ctx.newPage();
      await repositories.questions.save(question(ctx, archivedPage));
      await repositories.questions.save(question(ctx, inArchivedNotebook));
      await ctx.archivePage(archivedPage);
      await ctx.archiveNotebook(inArchivedNotebook);

      const ids = (await reader.listExamPages(ctx.ownerId)).map(
        (row) => row.pageId,
      );

      expect(ids).not.toContain(archivedPage.pageId);
      expect(ids).not.toContain(inArchivedNotebook.pageId);
    });

    it("orders by notebook title, then page title", async () => {
      const ctx = options.context();
      const { reader, repositories } = options.createFixture();
      const tag = ctx.newId();
      const second = await ctx.newPage({
        notebookTitle: `zz ${tag} B`,
        pageTitle: "A",
      });
      const third = await ctx.newPage({
        notebookTitle: `zz ${tag} B`,
        pageTitle: "B",
      });
      const first = await ctx.newPage({
        notebookTitle: `zz ${tag} A`,
        pageTitle: "Z",
      });
      for (const page of [second, third, first]) {
        await repositories.questions.save(question(ctx, page));
      }

      const ids = (await reader.listExamPages(ctx.ownerId))
        .map((row) => row.pageId)
        .filter((id) =>
          [first.pageId, second.pageId, third.pageId].includes(id),
        );

      expect(ids).toEqual([first.pageId, second.pageId, third.pageId]);
    });
  });
}
