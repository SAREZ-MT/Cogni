import {
  createExamReviewRecorder,
  createStudyItemRepository,
} from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import type {
  ExamSessionRepositories,
  ExamSessionUnitOfWork,
} from "../application/exam-session-work";
import { DrizzleExamAnswerRepository } from "./drizzle-exam-answer-repository";
import { DrizzleExamPageStateRepository } from "./drizzle-exam-page-state-repository";
import { DrizzleExamQuestionRepository } from "./drizzle-exam-question-repository";
import { DrizzleExamSessionRepository } from "./drizzle-exam-session-repository";

// One Postgres transaction per run over the exam tables and the SM-2
// engine: the review recorder is built on the same transaction, so
// recordExamReviews runs as a savepoint of it and a finished session, its
// page state and its reviews commit or roll back together.
export class DrizzleExamSessionUnitOfWork implements ExamSessionUnitOfWork {
  constructor(
    private readonly db: DbExecutor,
    private readonly ids: { next(): string },
  ) {}

  run<T>(
    work: (repositories: ExamSessionRepositories) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        questions: new DrizzleExamQuestionRepository(tx),
        sessions: new DrizzleExamSessionRepository(tx),
        answers: new DrizzleExamAnswerRepository(tx),
        pageStates: new DrizzleExamPageStateRepository(tx),
        studyItems: createStudyItemRepository(tx),
        reviews: createExamReviewRecorder({ db: tx, ids: this.ids }),
      }),
    );
  }
}
