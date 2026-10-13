import type { MasteryLevelName, PageProgressRow } from "../../domain/progress";
import type {
  AnswerOutcomeReader,
  ExamAnswerFact,
  PageProgressReader,
  RecallAnswerFact,
  ReviewHistoryReader,
} from "../../domain/readers";
import type { ReviewFact } from "../../domain/review-activity";
import type { ReviewBucket } from "../../domain/streak";
import type { Technique } from "../../domain/technique";

interface NotebookRow {
  id: string;
  ownerId: string;
  title: string;
  color: string | null;
  position: number;
  archived: boolean;
}

interface PageRow {
  id: string;
  ownerId: string;
  notebookId: string;
  title: string;
  position: number;
  archived: boolean;
}

interface ItemRow {
  pageId: string;
  dueAt: Date;
  suspended: boolean;
}

interface ReviewRow {
  pageId: string;
  technique: Technique;
  quality: number;
  reviewedAt: Date;
}

interface ExamAnswerRow {
  pageId: string;
  isCorrect: boolean;
  answeredAt: Date;
  finished: boolean;
}

interface RecallAnswerRow {
  pageId: string;
  selfRating: number;
  aiScore: number | null;
  status: "pending" | "done" | "failed";
  answeredAt: Date;
}

const BUCKET_MS = 15 * 60_000;

const inRange = (instant: Date, from: Date, to: Date) =>
  instant.getTime() >= from.getTime() && instant.getTime() < to.getTime();

const byInstant =
  <T>(instantOf: (row: T) => Date) =>
  (a: T, b: T) =>
    instantOf(a).getTime() - instantOf(b).getTime();

// In-memory ReviewHistoryReader, PageProgressReader and AnswerOutcomeReader
// for unit tests; satisfies the shared contract
// (analytics-readers.contract.ts). It stands in for the notebooks, pages,
// study_items, page_mastery, review_logs and answer tables, so tests seed
// it directly. Every row belongs to its page's owner, as in the database.
export class InMemoryAnalyticsStore
  implements ReviewHistoryReader, PageProgressReader, AnswerOutcomeReader
{
  private readonly notebooks = new Map<string, NotebookRow>();
  private readonly pages = new Map<string, PageRow>();
  private readonly mastery = new Map<
    string,
    { level: MasteryLevelName; score: number }
  >();
  private readonly items: ItemRow[] = [];
  private readonly reviews: ReviewRow[] = [];
  private readonly examAnswers: ExamAnswerRow[] = [];
  private readonly recallAnswers: RecallAnswerRow[] = [];

  addNotebook(notebook: Omit<NotebookRow, "archived">): void {
    this.notebooks.set(notebook.id, { ...notebook, archived: false });
  }

  addPage(page: Omit<PageRow, "archived">): void {
    this.pages.set(page.id, { ...page, archived: false });
  }

  archivePage(pageId: string): void {
    const page = this.pages.get(pageId);
    if (page) page.archived = true;
  }

  archiveNotebook(notebookId: string): void {
    const notebook = this.notebooks.get(notebookId);
    if (notebook) notebook.archived = true;
  }

  setMastery(
    pageId: string,
    mastery: { level: MasteryLevelName; score: number },
  ): void {
    this.mastery.set(pageId, mastery);
  }

  addItem(item: ItemRow): void {
    this.items.push(item);
  }

  addReview(review: ReviewRow): void {
    this.reviews.push(review);
  }

  addExamAnswer(answer: ExamAnswerRow): void {
    this.examAnswers.push(answer);
  }

  addRecallAnswer(answer: RecallAnswerRow): void {
    this.recallAnswers.push(answer);
  }

  // The owner's page with its notebook, when both are live.
  private live(
    ownerId: string,
    pageId: string,
  ): { page: PageRow; notebook: NotebookRow } | null {
    const page = this.pages.get(pageId);
    if (!page || page.ownerId !== ownerId || page.archived) return null;
    const notebook = this.notebooks.get(page.notebookId);
    if (!notebook || notebook.archived) return null;
    return { page, notebook };
  }

  async listReviews(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<ReviewFact[]> {
    return this.reviews
      .filter(
        (review) =>
          this.live(ownerId, review.pageId) &&
          inRange(review.reviewedAt, from, to),
      )
      .sort(byInstant((review) => review.reviewedAt))
      .map((review) => ({
        pageId: review.pageId,
        notebookId: (this.pages.get(review.pageId) as PageRow).notebookId,
        technique: review.technique,
        quality: review.quality,
        reviewedAt: review.reviewedAt,
      }));
  }

  async listReviewBuckets(ownerId: string): Promise<ReviewBucket[]> {
    const buckets = new Map<string, ReviewBucket>();
    for (const review of this.reviews) {
      if (!this.live(ownerId, review.pageId)) continue;
      const startsAt = new Date(
        Math.floor(review.reviewedAt.getTime() / BUCKET_MS) * BUCKET_MS,
      );
      buckets.set(`${startsAt.getTime()}|${review.technique}`, {
        technique: review.technique,
        startsAt,
      });
    }
    return [...buckets.values()].sort(
      (a, b) =>
        a.startsAt.getTime() - b.startsAt.getTime() ||
        (a.technique < b.technique ? -1 : 1),
    );
  }

  async listPageProgress(
    ownerId: string,
    now: Date,
  ): Promise<PageProgressRow[]> {
    const rows: Array<PageProgressRow & { order: [number, number] }> = [];
    for (const pageId of this.pages.keys()) {
      const live = this.live(ownerId, pageId);
      if (!live) continue;
      const items = this.items.filter(
        (item) => item.pageId === pageId && !item.suspended,
      );
      const mastery = this.mastery.get(pageId);
      rows.push({
        pageId,
        pageTitle: live.page.title,
        notebookId: live.notebook.id,
        notebookTitle: live.notebook.title,
        notebookColor: live.notebook.color,
        level: mastery?.level ?? null,
        score: mastery?.score ?? null,
        itemsTotal: items.length,
        itemsDue: items.filter((item) => item.dueAt.getTime() <= now.getTime())
          .length,
        order: [live.notebook.position, live.page.position],
      });
    }
    return rows
      .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1])
      .map(({ order: _order, ...row }) => row);
  }

  async listExamAnswers(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<ExamAnswerFact[]> {
    return this.examAnswers
      .filter(
        (answer) =>
          answer.finished &&
          this.live(ownerId, answer.pageId) &&
          inRange(answer.answeredAt, from, to),
      )
      .sort(byInstant((answer) => answer.answeredAt))
      .map(({ pageId, isCorrect, answeredAt }) => ({
        pageId,
        isCorrect,
        answeredAt,
      }));
  }

  async listRecallAnswers(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<RecallAnswerFact[]> {
    const facts: RecallAnswerFact[] = [];
    for (const answer of [...this.recallAnswers].sort(
      byInstant((row) => row.answeredAt),
    )) {
      const live = this.live(ownerId, answer.pageId);
      if (
        !live ||
        answer.status !== "done" ||
        answer.aiScore === null ||
        !inRange(answer.answeredAt, from, to)
      ) {
        continue;
      }
      facts.push({
        pageId: answer.pageId,
        pageTitle: live.page.title,
        notebookId: live.notebook.id,
        notebookTitle: live.notebook.title,
        selfRating: answer.selfRating,
        aiScore: answer.aiScore,
        answeredAt: answer.answeredAt,
      });
    }
    return facts;
  }
}
