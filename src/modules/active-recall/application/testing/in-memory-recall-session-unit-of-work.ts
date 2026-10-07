import type {
  RecallSessionRepositories,
  RecallSessionUnitOfWork,
} from "../recall-session-work";
import { createInMemoryRecallRepositories } from "./in-memory-recall-repositories";
import { InMemoryRecallStudyItems } from "./in-memory-recall-unit-of-work";

// Transactional fake of RecallSessionUnitOfWork: a run that throws puts
// sessions and answers back as they were before it, like the database
// transaction of DrizzleRecallSessionUnitOfWork. Row locks are not
// modelled (runs never interleave in a single-threaded test).
export class InMemoryRecallSessionUnitOfWork
  implements RecallSessionUnitOfWork
{
  runs = 0;
  readonly repos: ReturnType<typeof createInMemoryRecallRepositories> & {
    studyItems: InMemoryRecallStudyItems;
  };

  constructor() {
    this.repos = {
      ...createInMemoryRecallRepositories(),
      studyItems: new InMemoryRecallStudyItems(),
    };
  }

  async run<T>(
    work: (repositories: RecallSessionRepositories) => Promise<T>,
  ): Promise<T> {
    this.runs += 1;
    const sessions = [...this.repos.sessions.rows.values()];
    const answers = this.repos.answers.snapshot();
    try {
      return await work(this.repos);
    } catch (error) {
      this.repos.sessions.rows.clear();
      for (const s of sessions) this.repos.sessions.rows.set(s.id, s);
      this.repos.answers.restore(answers);
      throw error;
    }
  }
}
