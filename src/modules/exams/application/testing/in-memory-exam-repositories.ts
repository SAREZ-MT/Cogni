import type { ExamAnswerRepository } from "../../domain/exam-answer-repository";
import type { ExamPageStateRepository } from "../../domain/exam-page-state-repository";
import type { ExamQuestion } from "../../domain/exam-question";
import type { ExamQuestionRepository } from "../../domain/exam-question-repository";
import type {
  ExamAnswer,
  ExamPageState,
  ExamSession,
} from "../../domain/exam-session";
import type { ExamSessionRepository } from "../../domain/exam-session-repository";

// In-memory exam repositories for unit tests; they satisfy the shared
// contract (exam-repositories.contract.ts). Orderings break ties by id,
// like the Drizzle adapters.

function byTimeThenKey<T>(time: (row: T) => Date, key: (row: T) => string) {
  return (a: T, b: T) =>
    time(a).getTime() - time(b).getTime() ||
    (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
}

export class InMemoryExamQuestionRepository implements ExamQuestionRepository {
  private readonly rows = new Map<string, ExamQuestion>();

  async save(question: ExamQuestion): Promise<void> {
    if (this.rows.has(question.id)) {
      throw new Error("duplicate exam question id");
    }
    this.rows.set(question.id, question);
  }

  async update(question: ExamQuestion): Promise<ExamQuestion | null> {
    const stored = await this.findById(question.id, question.ownerId);
    if (!stored) return null;
    const updated: ExamQuestion = {
      ...stored,
      stem: question.stem,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      concept: question.concept,
      updatedAt: question.updatedAt,
    };
    this.rows.set(updated.id, updated);
    return updated;
  }

  async findById(id: string, ownerId: string): Promise<ExamQuestion | null> {
    const question = this.rows.get(id);
    return question && question.ownerId === ownerId ? question : null;
  }

  async listActiveByPage(
    pageId: string,
    ownerId: string,
  ): Promise<ExamQuestion[]> {
    return this.list(
      (q) => q.pageId === pageId && q.ownerId === ownerId && !q.retiredAt,
    );
  }

  async listShownAt(
    pageId: string,
    ownerId: string,
    at: Date,
  ): Promise<ExamQuestion[]> {
    return this.list(
      (q) =>
        q.pageId === pageId &&
        q.ownerId === ownerId &&
        q.createdAt.getTime() <= at.getTime() &&
        (q.retiredAt === null || q.retiredAt.getTime() > at.getTime()),
    );
  }

  async listLineage(rootId: string, ownerId: string): Promise<ExamQuestion[]> {
    return this.list((q) => q.rootId === rootId && q.ownerId === ownerId);
  }

  // A single-threaded fake has no concurrent transactions to queue.
  async lockLineage(): Promise<void> {}

  async retire(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<ExamQuestion | null> {
    const stored = await this.findById(id, ownerId);
    if (!stored) return null;
    if (stored.retiredAt !== null) return stored;
    const retired = { ...stored, retiredAt: now, updatedAt: now };
    this.rows.set(id, retired);
    return retired;
  }

  // Test helpers for a transactional fake unit of work: copy the stored
  // rows before a run and put them back when it throws.
  snapshot(): ExamQuestion[] {
    return [...this.rows.values()];
  }

  restore(rows: readonly ExamQuestion[]): void {
    this.rows.clear();
    for (const row of rows) this.rows.set(row.id, row);
  }

  private list(keep: (question: ExamQuestion) => boolean): ExamQuestion[] {
    return [...this.rows.values()].filter(keep).sort(
      byTimeThenKey(
        (q) => q.createdAt,
        (q) => q.id,
      ),
    );
  }
}

export class InMemoryExamSessionRepository implements ExamSessionRepository {
  private readonly rows = new Map<string, ExamSession>();

  async create(session: ExamSession): Promise<void> {
    if (this.rows.has(session.id)) {
      throw new Error("duplicate exam session id");
    }
    this.rows.set(session.id, session);
  }

  async findById(id: string, ownerId: string): Promise<ExamSession | null> {
    const session = this.rows.get(id);
    return session && session.ownerId === ownerId ? session : null;
  }

  async lockById(id: string, ownerId: string): Promise<ExamSession | null> {
    return this.findById(id, ownerId);
  }

  async findOpenByPage(
    pageId: string,
    ownerId: string,
  ): Promise<ExamSession | null> {
    const open = [...this.rows.values()]
      .filter(
        (s) =>
          s.pageId === pageId &&
          s.ownerId === ownerId &&
          s.finishedAt === null &&
          !s.isRetake,
      )
      .sort(
        byTimeThenKey(
          (s) => s.startedAt,
          (s) => s.id,
        ),
      );
    return open.at(-1) ?? null;
  }

  // A single-threaded fake has no concurrent starts to queue.
  async lockPageForStart(): Promise<void> {}

  async finish(session: ExamSession): Promise<ExamSession | null> {
    const stored = await this.findById(session.id, session.ownerId);
    if (!stored) return null;
    if (stored.finishedAt !== null) return stored;
    const finished: ExamSession = {
      ...stored,
      finishedAt: session.finishedAt,
      total: session.total,
      correct: session.correct,
      score: session.score,
      passed: session.passed,
    };
    this.rows.set(finished.id, finished);
    return finished;
  }

  async listFinishedByPage(
    pageId: string,
    ownerId: string,
  ): Promise<ExamSession[]> {
    return [...this.rows.values()]
      .filter(
        (s) =>
          s.pageId === pageId && s.ownerId === ownerId && s.finishedAt !== null,
      )
      .sort(
        byTimeThenKey(
          (s) => s.finishedAt as Date,
          (s) => s.id,
        ),
      );
  }

  snapshot(): ExamSession[] {
    return [...this.rows.values()];
  }

  restore(rows: readonly ExamSession[]): void {
    this.rows.clear();
    for (const row of rows) this.rows.set(row.id, row);
  }
}

// Needs the session and question fakes to check ownership, as the table's
// foreign keys and the Drizzle adapter's checks do: the session and the
// question are the owner's, the question is on the session's page and the
// answer's root is the question's root.
export class InMemoryExamAnswerRepository implements ExamAnswerRepository {
  private readonly rows: { ownerId: string; answer: ExamAnswer }[] = [];

  constructor(
    private readonly sessions: ExamSessionRepository,
    private readonly questions: ExamQuestionRepository,
  ) {}

  async saveMany(
    answers: readonly ExamAnswer[],
    ownerId: string,
  ): Promise<void> {
    const seen = new Set(
      this.rows.flatMap(({ answer }) => [
        `${answer.sessionId}:q:${answer.questionId}`,
        `${answer.sessionId}:r:${answer.rootId}`,
      ]),
    );
    for (const answer of answers) {
      const session = await this.sessions.findById(answer.sessionId, ownerId);
      if (!session) {
        throw new Error(`exam session ${answer.sessionId} not found`);
      }
      const question = await this.questions.findById(
        answer.questionId,
        ownerId,
      );
      if (
        !question ||
        question.rootId !== answer.rootId ||
        question.pageId !== session.pageId
      ) {
        throw new Error(
          `exam question ${answer.questionId} does not fit the answer`,
        );
      }
      for (const key of [
        `${answer.sessionId}:q:${answer.questionId}`,
        `${answer.sessionId}:r:${answer.rootId}`,
      ]) {
        if (seen.has(key)) throw new Error(`duplicate exam answer ${key}`);
        seen.add(key);
      }
    }
    for (const answer of answers) this.rows.push({ ownerId, answer });
  }

  async listBySession(
    sessionId: string,
    ownerId: string,
  ): Promise<ExamAnswer[]> {
    return this.rows
      .filter(
        (row) => row.ownerId === ownerId && row.answer.sessionId === sessionId,
      )
      .map((row) => row.answer)
      .sort(
        byTimeThenKey(
          (a) => a.answeredAt,
          (a) => a.questionId,
        ),
      );
  }

  async lastAnsweredAtByRoot(
    pageId: string,
    ownerId: string,
    before: Date,
  ): Promise<Map<string, Date>> {
    const latest = new Map<string, Date>();
    for (const { ownerId: owner, answer } of this.rows) {
      if (owner !== ownerId) continue;
      if (answer.answeredAt.getTime() >= before.getTime()) continue;
      const session = await this.sessions.findById(answer.sessionId, ownerId);
      if (session?.pageId !== pageId) continue;
      const seen = latest.get(answer.rootId);
      if (!seen || seen.getTime() < answer.answeredAt.getTime()) {
        latest.set(answer.rootId, answer.answeredAt);
      }
    }
    return latest;
  }

  snapshot(): { ownerId: string; answer: ExamAnswer }[] {
    return [...this.rows];
  }

  restore(rows: readonly { ownerId: string; answer: ExamAnswer }[]): void {
    this.rows.splice(0, this.rows.length, ...rows);
  }
}

export class InMemoryExamPageStateRepository
  implements ExamPageStateRepository
{
  private readonly rows = new Map<string, ExamPageState>();

  // Stands in for the pages table: whether `pageId` is `ownerId`'s page.
  constructor(
    private readonly isPageOwnedBy: (
      pageId: string,
      ownerId: string,
    ) => boolean = () => true,
  ) {}

  async get(pageId: string, ownerId: string): Promise<ExamPageState | null> {
    const state = this.rows.get(pageId);
    return state && state.ownerId === ownerId ? state : null;
  }

  async upsert(state: ExamPageState): Promise<void> {
    if (!this.isPageOwnedBy(state.pageId, state.ownerId)) return;
    const stored = this.rows.get(state.pageId);
    if (stored && stored.ownerId !== state.ownerId) return;
    this.rows.set(state.pageId, {
      ...state,
      failedRootIds: [...state.failedRootIds],
    });
  }

  snapshot(): ExamPageState[] {
    return [...this.rows.values()];
  }

  restore(rows: readonly ExamPageState[]): void {
    this.rows.clear();
    for (const row of rows) this.rows.set(row.pageId, row);
  }
}

// `isPageOwnedBy` stands in for the pages table (every page is the
// caller's by default).
export function createInMemoryExamRepositories(
  options: {
    isPageOwnedBy?: (pageId: string, ownerId: string) => boolean;
  } = {},
) {
  const sessions = new InMemoryExamSessionRepository();
  const questions = new InMemoryExamQuestionRepository();
  return {
    questions,
    sessions,
    answers: new InMemoryExamAnswerRepository(sessions, questions),
    pageStates: new InMemoryExamPageStateRepository(options.isPageOwnedBy),
  };
}
