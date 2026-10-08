import type { DbExecutor } from "@/shared/db/client";
import { DrizzleRecallAnswerRepository } from "./drizzle-recall-answer-repository";
import { DrizzleRecallQuestionRepository } from "./drizzle-recall-question-repository";
import { DrizzleRecallSessionRepository } from "./drizzle-recall-session-repository";

export { DrizzleRecallAnswerRepository } from "./drizzle-recall-answer-repository";
export { DrizzleRecallFingerprints } from "./drizzle-recall-fingerprints";
export { DrizzleRecallHubReader } from "./drizzle-recall-hub-reader";
export { DrizzleRecallQuestionRepository } from "./drizzle-recall-question-repository";
export { DrizzleRecallSessionRepository } from "./drizzle-recall-session-repository";
export { DrizzleRecallSessionUnitOfWork } from "./drizzle-recall-session-unit-of-work";
export { DrizzleRecallUnitOfWork } from "./drizzle-recall-unit-of-work";

// Every active-recall repository on one executor. `db` may be an open
// transaction (also shared with study-engine's repositories), so
// everything written through them commits or rolls back with the caller.
export function createDrizzleRecallRepositories(db: DbExecutor) {
  return {
    questions: new DrizzleRecallQuestionRepository(db),
    sessions: new DrizzleRecallSessionRepository(db),
    answers: new DrizzleRecallAnswerRepository(db),
  };
}
