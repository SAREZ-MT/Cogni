import type { StudyItem, StudyItemKind } from "@/modules/study-engine";
import {
  InMemoryGenerationFingerprintStore,
  type InMemoryGenerationFingerprints,
} from "@/shared/kernel/testing/in-memory-generation-fingerprints";
import type {
  ExamQuestionRepositories,
  ExamStudyItems,
  ExamUnitOfWork,
} from "../exam-unit-of-work";
import { InMemoryExamQuestionRepository } from "./in-memory-exam-repositories";

// Minimal in-memory ExamStudyItems. The full fake lives in study-engine's
// testing.ts, which cross-module-via-index keeps out of reach of this
// module; this one covers the three methods a question change uses, with
// the same unique (kind, sourceId) rule as the database.
export class InMemoryExamStudyItems implements ExamStudyItems {
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

  async findBySource(
    kind: StudyItemKind,
    sourceId: string,
    ownerId: string,
  ): Promise<StudyItem | null> {
    for (const row of this.rows.values()) {
      if (
        row.kind === kind &&
        row.sourceId === sourceId &&
        row.ownerId === ownerId
      ) {
        return row;
      }
    }
    return null;
  }

  async suspend(
    id: string,
    ownerId: string,
    now: Date,
  ): Promise<StudyItem | null> {
    const item = this.rows.get(id);
    if (!item || item.ownerId !== ownerId) return null;
    if (item.suspendedAt !== null) return item;
    const suspended = { ...item, suspendedAt: now, updatedAt: now };
    this.rows.set(id, suspended);
    return suspended;
  }

  // Test helpers.
  all(): StudyItem[] {
    return [...this.rows.values()];
  }

  snapshot(): StudyItem[] {
    return this.all();
  }

  restore(rows: readonly StudyItem[]): void {
    this.rows.clear();
    for (const row of rows) this.rows.set(row.id, row);
  }
}

// Transactional fake: a run that throws puts both stores back as they were
// before it, like the database transaction of DrizzleExamUnitOfWork.
export class InMemoryExamUnitOfWork implements ExamUnitOfWork {
  runs = 0;

  constructor(
    readonly questions = new InMemoryExamQuestionRepository(),
    readonly studyItems = new InMemoryExamStudyItems(),
    readonly fingerprints: InMemoryGenerationFingerprints = new InMemoryGenerationFingerprintStore().forTechnique(
      "exam",
    ),
  ) {}

  async run<T>(
    work: (repositories: ExamQuestionRepositories) => Promise<T>,
  ): Promise<T> {
    this.runs += 1;
    const questions = this.questions.snapshot();
    const items = this.studyItems.snapshot();
    const fingerprints = this.fingerprints.store.snapshot();
    try {
      return await work({
        questions: this.questions,
        studyItems: this.studyItems,
        fingerprints: this.fingerprints,
      });
    } catch (error) {
      this.questions.restore(questions);
      this.studyItems.restore(items);
      this.fingerprints.store.restore(fingerprints);
      throw error;
    }
  }
}
