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

  async listLineage(rootId: string, ownerId: string): Promise<ExamQuestion[]> {
    return this.list((q) => q.rootId === rootId && q.ownerId === ownerId);
  }

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
}

// Needs the session fake to check ownership, as the table's foreign key
// and the Drizzle adapter's owner check do.
export class InMemoryExamAnswerRepository implements ExamAnswerRepository {
  private readonly rows: { ownerId: string; answer: ExamAnswer }[] = [];

  constructor(private readonly sessions: ExamSessionRepository) {}

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
      if (!(await this.sessions.findById(answer.sessionId, ownerId))) {
        throw new Error(`exam session ${answer.sessionId} not found`);
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
}

export class InMemoryExamPageStateRepository
  implements ExamPageStateRepository
{
  private readonly rows = new Map<string, ExamPageState>();

  async get(pageId: string, ownerId: string): Promise<ExamPageState | null> {
    const state = this.rows.get(pageId);
    return state && state.ownerId === ownerId ? state : null;
  }

  async upsert(state: ExamPageState): Promise<void> {
    const stored = this.rows.get(state.pageId);
    if (stored && stored.ownerId !== state.ownerId) return;
    this.rows.set(state.pageId, {
      ...state,
      failedRootIds: [...state.failedRootIds],
    });
  }
}

export function createInMemoryExamRepositories() {
  const sessions = new InMemoryExamSessionRepository();
  return {
    questions: new InMemoryExamQuestionRepository(),
    sessions,
    answers: new InMemoryExamAnswerRepository(sessions),
    pageStates: new InMemoryExamPageStateRepository(),
  };
}
