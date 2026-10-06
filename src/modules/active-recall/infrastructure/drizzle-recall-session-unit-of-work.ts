import { createStudyItemRepository } from "@/modules/study-engine";
import type { DbExecutor } from "@/shared/db/client";
import type {
  RecallSessionRepositories,
  RecallSessionUnitOfWork,
} from "../application/recall-session-work";
import { createDrizzleRecallRepositories } from "./index";

// One Postgres transaction per run over the recall tables and the page's
// study items: the session row lock (lockById) holds until the run ends, so
// saving an answer and finishing the session queue.
export class DrizzleRecallSessionUnitOfWork implements RecallSessionUnitOfWork {
  constructor(private readonly db: DbExecutor) {}

  run<T>(
    work: (repositories: RecallSessionRepositories) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        ...createDrizzleRecallRepositories(tx),
        studyItems: createStudyItemRepository(tx),
      }),
    );
  }
}
