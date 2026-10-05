import {
  newStudyItem,
  type RecordExamReviewsInput,
  type StudyItem,
} from "@/modules/study-engine";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok } from "@/shared/kernel/result";
import type {
  ExamReviews,
  ExamSessionRepositories,
  ExamSessionUnitOfWork,
} from "../exam-session-work";
import { createInMemoryExamRepositories } from "./in-memory-exam-repositories";

// Records what a finished exam sends to the SM-2 engine. `failNext` makes
// the next call answer err, as recordExamReviews does for a root without a
// study item.
export class FakeExamReviews implements ExamReviews {
  readonly calls: RecordExamReviewsInput[] = [];
  failNext = false;

  async record(input: RecordExamReviewsInput) {
    if (this.failNext) {
      this.failNext = false;
      return err(
        new DomainError("STUDY_ENGINE_ITEM_NOT_FOUND", "no study item"),
      );
    }
    this.calls.push(input);
    return ok({
      reviewedRootIds: input.answers.map((answer) => answer.rootId),
      skippedRootIds: [],
      mastery: {} as never,
    });
  }

  snapshot(): RecordExamReviewsInput[] {
    return [...this.calls];
  }

  restore(calls: readonly RecordExamReviewsInput[]): void {
    this.calls.splice(0, this.calls.length, ...calls);
  }
}

// The roots' study items as listByPage reads them; add with `addItem`.
export class FakeExamStudyItems {
  readonly items: StudyItem[] = [];

  addItem(input: {
    ownerId: string;
    pageId: string;
    rootId: string;
    dueAt: Date;
  }): void {
    this.items.push({
      ...newStudyItem({
        id: `item-${input.rootId}`,
        ownerId: input.ownerId,
        pageId: input.pageId,
        kind: "exam_question",
        sourceId: input.rootId,
        now: input.dueAt,
      }),
      dueAt: input.dueAt,
    });
  }

  async listByPage(pageId: string, ownerId: string): Promise<StudyItem[]> {
    return this.items.filter(
      (item) => item.pageId === pageId && item.ownerId === ownerId,
    );
  }
}

// Transactional fake of ExamSessionUnitOfWork: a run that throws puts every
// store back as it was, like the database transaction.
export class InMemoryExamSessionUnitOfWork implements ExamSessionUnitOfWork {
  readonly repos = createInMemoryExamRepositories();
  readonly studyItems = new FakeExamStudyItems();
  readonly reviews = new FakeExamReviews();
  runs = 0;

  async run<T>(
    work: (repositories: ExamSessionRepositories) => Promise<T>,
  ): Promise<T> {
    this.runs += 1;
    const { questions, sessions, answers, pageStates } = this.repos;
    const saved = {
      questions: questions.snapshot(),
      sessions: sessions.snapshot(),
      answers: answers.snapshot(),
      pageStates: pageStates.snapshot(),
      reviews: this.reviews.snapshot(),
    };
    try {
      return await work({
        questions,
        sessions,
        answers,
        pageStates,
        studyItems: this.studyItems,
        reviews: this.reviews,
      });
    } catch (error) {
      questions.restore(saved.questions);
      sessions.restore(saved.sessions);
      answers.restore(saved.answers);
      pageStates.restore(saved.pageStates);
      this.reviews.restore(saved.reviews);
      throw error;
    }
  }
}
