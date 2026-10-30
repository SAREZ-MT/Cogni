import type { PageProgressRow } from "./progress";
import type { ReviewFact } from "./review-activity";
import type { ReviewBucket } from "./streak";

// Read ports of the dashboard. Every read is owner-scoped (another owner's
// rows never appear) and skips archived pages and pages of archived
// notebooks, as the calendar does. Ranges are [from, to) instants; the
// readers never see the time zone (local-day bucketing is domain logic).

export interface ReviewHistoryReader {
  // review_logs rows with `from <= reviewed_at < to`, ordered by
  // reviewed_at.
  listReviews(ownerId: string, from: Date, to: Date): Promise<ReviewFact[]>;
  // The whole history reduced to distinct (technique, 15-minute UTC
  // bucket) pairs, ordered by bucket then technique name in code-unit
  // (byte) order, independent of the database collation: enough to find every
  // local day with a review in any zone, bounded by the time spent
  // reviewing instead of by the number of reviews.
  listReviewBuckets(ownerId: string): Promise<ReviewBucket[]>;
}

export interface PageProgressReader {
  // Every live page with its notebook, its page_mastery level and score
  // (null without a row) and its live item counts: non-suspended items,
  // and those with `due_at < dueBefore` (the start of the owner's next
  // local day: reviews are due per day). Ordered by notebook position,
  // then page position.
  listPageProgress(
    ownerId: string,
    dueBefore: Date,
  ): Promise<PageProgressRow[]>;
}

// One graded exam answer (exam_answers.is_correct) of a finished exam.
export interface ExamAnswerFact {
  pageId: string;
  isCorrect: boolean;
  answeredAt: Date;
}

// One evaluated ("done") recall answer: its self-rating and AI score.
export interface RecallAnswerFact {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  selfRating: number;
  aiScore: number;
  answeredAt: Date;
}

export interface AnswerOutcomeReader {
  // Answers of finished exams with `from <= answered_at < to`, ordered by
  // answered_at.
  listExamAnswers(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<ExamAnswerFact[]>;
  // Evaluated recall answers saved with `from <= created_at < to`, ordered
  // by created_at.
  listRecallAnswers(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<RecallAnswerFact[]>;
}
