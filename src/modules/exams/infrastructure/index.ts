import type { DbExecutor } from "@/shared/db/client";
import { DrizzleExamAnswerRepository } from "./drizzle-exam-answer-repository";
import { DrizzleExamPageStateRepository } from "./drizzle-exam-page-state-repository";
import { DrizzleExamQuestionRepository } from "./drizzle-exam-question-repository";
import { DrizzleExamSessionRepository } from "./drizzle-exam-session-repository";

export { DrizzleExamAnswerRepository } from "./drizzle-exam-answer-repository";
export { DrizzleExamPageStateRepository } from "./drizzle-exam-page-state-repository";
export { DrizzleExamQuestionRepository } from "./drizzle-exam-question-repository";
export { DrizzleExamSessionRepository } from "./drizzle-exam-session-repository";
export { DrizzleExamSessionUnitOfWork } from "./drizzle-exam-session-unit-of-work";
export { DrizzleExamUnitOfWork } from "./drizzle-exam-unit-of-work";

// Every exam repository on one executor. `db` may be an open transaction
// (also shared with study-engine's repositories), so everything written
// through them commits or rolls back with the caller.
export function createDrizzleExamRepositories(db: DbExecutor) {
  return {
    questions: new DrizzleExamQuestionRepository(db),
    sessions: new DrizzleExamSessionRepository(db),
    answers: new DrizzleExamAnswerRepository(db),
    pageStates: new DrizzleExamPageStateRepository(db),
  };
}
