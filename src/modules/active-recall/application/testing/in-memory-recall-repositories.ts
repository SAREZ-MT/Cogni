import { isRecallScore, type RecallAnswer } from "../../domain/recall-answer";
import type {
  RecallAnswerRepository,
  RecallEvaluationResult,
} from "../../domain/recall-answer-repository";
import type { RecallQuestion } from "../../domain/recall-question";
import type { RecallQuestionRepository } from "../../domain/recall-question-repository";
import type {
  RecallSession,
  RecallSessionEvaluationStatus,
} from "../../domain/recall-session";
import type { RecallSessionRepository } from "../../domain/recall-session-repository";
import type { RecallRepositories } from "./recall-repositories.contract";

// In-memory active-recall repositories for unit tests; they satisfy the
// shared contract (recall-repositories.contract.ts). Orderings break ties
// by id, like the Drizzle adapters.

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function oldestFirst<T extends { createdAt: Date; id: string }>(a: T, b: T) {
  return (
    a.createdAt.getTime() - b.createdAt.getTime() || compareIds(a.id, b.id)
  );
}

function latestStartedFirst(a: RecallSession, b: RecallSession) {
  return (
    b.startedAt.getTime() - a.startedAt.getTime() || compareIds(b.id, a.id)
  );
}

export class InMemoryRecallQuestionRepository
  implements RecallQuestionRepository
{
  readonly rows = new Map<string, RecallQuestion>();

  async saveMany(questions: readonly RecallQuestion[]): Promise<void> {
    const ids = new Set<string>();
    for (const question of questions) {
      if (this.rows.has(question.id) || ids.has(question.id)) {
        throw new Error("duplicate recall question id");
      }
      ids.add(question.id);
    }
    for (const question of questions) this.rows.set(question.id, question);
  }

  async listActiveByPage(
    pageId: string,
    ownerId: string,
  ): Promise<RecallQuestion[]> {
    return this.list(
      (q) => q.pageId === pageId && q.ownerId === ownerId && !q.archivedAt,
    );
  }

  async listByIds(
    ids: readonly string[],
    ownerId: string,
  ): Promise<RecallQuestion[]> {
    const wanted = new Set(ids);
    return this.list((q) => wanted.has(q.id) && q.ownerId === ownerId);
  }

  private list(keep: (q: RecallQuestion) => boolean): RecallQuestion[] {
    return [...this.rows.values()].filter(keep).sort(oldestFirst);
  }
}

export class InMemoryRecallSessionRepository
  implements RecallSessionRepository
{
  readonly rows = new Map<string, RecallSession>();

  async create(session: RecallSession): Promise<void> {
    if (this.rows.has(session.id)) {
      throw new Error("duplicate recall session id");
    }
    this.rows.set(session.id, session);
  }

  async findById(id: string, ownerId: string): Promise<RecallSession | null> {
    const session = this.rows.get(id);
    return session && session.ownerId === ownerId ? session : null;
  }

  async lockById(id: string, ownerId: string): Promise<RecallSession | null> {
    return this.findById(id, ownerId);
  }

  async finish(
    id: string,
    ownerId: string,
    finishedAt: Date,
  ): Promise<RecallSession | null> {
    const stored = await this.findById(id, ownerId);
    if (!stored || stored.finishedAt) return stored;
    const finished = { ...stored, finishedAt };
    this.rows.set(id, finished);
    return finished;
  }

  async setEvaluationStatus(
    id: string,
    ownerId: string,
    status: RecallSessionEvaluationStatus,
    _now: Date,
  ): Promise<RecallSession | null> {
    const stored = await this.findById(id, ownerId);
    if (!stored) return null;
    // Same rule as recall_sessions_evaluation_status_check.
    if (status !== "pending" && !stored.finishedAt) {
      throw new Error("an open recall session can only be pending");
    }
    const updated = { ...stored, evaluationStatus: status };
    this.rows.set(id, updated);
    return updated;
  }

  async listByPage(
    pageId: string,
    ownerId: string,
    limit: number,
  ): Promise<RecallSession[]> {
    return this.latest(
      (s) => s.pageId === pageId && s.ownerId === ownerId,
      limit,
    );
  }

  async listRecentByOwner(
    ownerId: string,
    limit: number,
  ): Promise<RecallSession[]> {
    return this.latest((s) => s.ownerId === ownerId, limit);
  }

  private latest(keep: (s: RecallSession) => boolean, limit: number) {
    return [...this.rows.values()]
      .filter(keep)
      .sort(latestStartedFirst)
      .slice(0, limit);
  }
}

export class InMemoryRecallAnswerRepository implements RecallAnswerRepository {
  private readonly rows = new Map<string, RecallAnswer>();
  // When a run claimed each pending answer (evaluation_claimed_at).
  private readonly claims = new Map<string, Date>();

  constructor(
    private readonly questions: InMemoryRecallQuestionRepository,
    private readonly sessions: InMemoryRecallSessionRepository,
  ) {}

  async upsert(answer: RecallAnswer): Promise<RecallAnswer> {
    const session = await this.sessions.findById(
      answer.sessionId,
      answer.ownerId,
    );
    const [question] = await this.questions.listByIds(
      [answer.questionId],
      answer.ownerId,
    );
    if (!session || !question || question.pageId !== session.pageId) {
      throw new Error("recall answer does not fit its session and question");
    }
    const stored = [...this.rows.values()].find(
      (row) =>
        row.sessionId === answer.sessionId &&
        row.questionId === answer.questionId,
    );
    if (!stored) {
      this.rows.set(answer.id, answer);
      return answer;
    }
    if (stored.evaluationStatus !== "pending" || this.claims.has(stored.id)) {
      return stored;
    }
    const updated = {
      ...stored,
      answerText: answer.answerText,
      selfRating: answer.selfRating,
      updatedAt: answer.updatedAt,
    };
    this.rows.set(stored.id, updated);
    return updated;
  }

  async listBySession(
    sessionId: string,
    ownerId: string,
  ): Promise<RecallAnswer[]> {
    return [...this.rows.values()]
      .filter((a) => a.sessionId === sessionId && a.ownerId === ownerId)
      .sort(oldestFirst);
  }

  async claimPendingForEvaluation(
    sessionId: string,
    ownerId: string,
    staleBefore: Date,
    now: Date,
  ): Promise<RecallAnswer[]> {
    const claimable = (await this.listBySession(sessionId, ownerId)).filter(
      (a) => {
        const claimedAt = this.claims.get(a.id);
        return (
          a.evaluationStatus === "pending" &&
          (!claimedAt || claimedAt.getTime() < staleBefore.getTime())
        );
      },
    );
    return claimable.map((a) => {
      const claimed = { ...a, updatedAt: now };
      this.rows.set(a.id, claimed);
      this.claims.set(a.id, now);
      return claimed;
    });
  }

  async saveEvaluation(
    id: string,
    ownerId: string,
    result: RecallEvaluationResult,
    now: Date,
  ): Promise<RecallAnswer | null> {
    const stored = this.find(id, ownerId);
    if (!stored || stored.evaluationStatus !== "pending") return stored;
    // Same rules as the recall_answers score and status checks.
    if (
      result.status === "done" &&
      !(isRecallScore(result.aiScore) && isRecallScore(result.combinedQuality))
    ) {
      throw new Error("recall scores are integers from 0 to 5");
    }
    const resolved: RecallAnswer = {
      ...stored,
      evaluationStatus: result.status,
      aiEvaluation: result.aiEvaluation,
      aiScore: result.status === "done" ? result.aiScore : null,
      combinedQuality: result.status === "done" ? result.combinedQuality : null,
      generationId: result.generationId,
      updatedAt: now,
    };
    this.rows.set(id, resolved);
    this.claims.delete(id);
    return resolved;
  }

  async requeueFailed(
    sessionId: string,
    ownerId: string,
    now: Date,
  ): Promise<number> {
    const failed = (await this.listBySession(sessionId, ownerId)).filter(
      (a) => a.evaluationStatus === "failed",
    );
    for (const a of failed) {
      this.rows.set(a.id, {
        ...a,
        evaluationStatus: "pending",
        updatedAt: now,
      });
      this.claims.delete(a.id);
    }
    return failed.length;
  }

  async markDisagreed(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<RecallAnswer | null> {
    const stored = this.find(id, ownerId);
    if (!stored || stored.disagreed) return stored;
    const updated = { ...stored, disagreed: true, updatedAt: now };
    this.rows.set(id, updated);
    return updated;
  }

  private find(id: string, ownerId: string): RecallAnswer | null {
    const answer = this.rows.get(id);
    return answer && answer.ownerId === ownerId ? answer : null;
  }
}

// One set of fakes sharing their rows, so answers see the questions and
// sessions they belong to (the foreign keys of the real tables).
export function createInMemoryRecallRepositories() {
  const questions = new InMemoryRecallQuestionRepository();
  const sessions = new InMemoryRecallSessionRepository();
  const answers = new InMemoryRecallAnswerRepository(questions, sessions);
  return { questions, sessions, answers } satisfies RecallRepositories;
}
