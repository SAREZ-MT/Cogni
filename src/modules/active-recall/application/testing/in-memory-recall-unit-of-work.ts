import type { StudyItem } from "@/modules/study-engine";
import type { RecallQuestion } from "../../domain/recall-question";
import type {
  RecallQuestionRepositories,
  RecallStudyItems,
  RecallUnitOfWork,
} from "../recall-unit-of-work";
import { InMemoryRecallQuestionRepository } from "./in-memory-recall-repositories";

// Minimal in-memory RecallStudyItems. The full fake lives in
// study-engine's testing.ts, which cross-module-via-index keeps out of
// reach of this module; this one covers `save`, with the same unique
// (kind, sourceId) rule as the database.
export class InMemoryRecallStudyItems implements RecallStudyItems {
  private readonly rows = new Map<string, StudyItem>();
  // Test hook: the next save throws, as a failing database write would.
  failNextSave = false;

  async save(item: StudyItem): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error("study item write failed");
    }
    for (const row of this.rows.values()) {
      if (
        row.id !== item.id &&
        row.kind === item.kind &&
        row.sourceId === item.sourceId
      ) {
        throw new Error("duplicate study item for (kind, sourceId)");
      }
    }
    this.rows.set(item.id, item);
  }

  // Every item of the page, suspended ones included, ordered by creation
  // (StudyItemRepository.listByPage).
  async listByPage(pageId: string, ownerId: string): Promise<StudyItem[]> {
    return this.all()
      .filter((item) => item.pageId === pageId && item.ownerId === ownerId)
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          (a.id < b.id ? -1 : 1),
      );
  }

  all(): StudyItem[] {
    return [...this.rows.values()];
  }

  restore(rows: readonly StudyItem[]): void {
    this.rows.clear();
    for (const row of rows) this.rows.set(row.id, row);
  }
}

// Transactional fake: a run that throws puts both stores back as they were
// before it, like the database transaction of DrizzleRecallUnitOfWork.
export class InMemoryRecallUnitOfWork implements RecallUnitOfWork {
  runs = 0;
  // Test hook: called inside the next run before the work, as a concurrent
  // writer committing during the model call would be seen by it.
  beforeNextRun:
    | ((questions: InMemoryRecallQuestionRepository) => Promise<void>)
    | null = null;

  constructor(
    readonly questions = new InMemoryRecallQuestionRepository(),
    readonly studyItems = new InMemoryRecallStudyItems(),
  ) {}

  async run<T>(
    work: (repositories: RecallQuestionRepositories) => Promise<T>,
  ): Promise<T> {
    this.runs += 1;
    const hook = this.beforeNextRun;
    this.beforeNextRun = null;
    if (hook) await hook(this.questions);
    const questions: RecallQuestion[] = [...this.questions.rows.values()];
    const items = this.studyItems.all();
    try {
      return await work({
        questions: this.questions,
        studyItems: this.studyItems,
      });
    } catch (error) {
      this.questions.rows.clear();
      for (const q of questions) this.questions.rows.set(q.id, q);
      this.studyItems.restore(items);
      throw error;
    }
  }
}
