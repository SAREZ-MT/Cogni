import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { notebooks, pages, reviewLogs, studyItems } from "@/shared/db/schema";
import type { ReviewHistoryReader } from "../domain/readers";
import type { ReviewFact } from "../domain/review-activity";
import type { ReviewBucket } from "../domain/streak";
import { livePage } from "./live-pages";

// review_logs reads behind the dashboard (served by the
// (owner_id, reviewed_at) index), joined through the study item to its
// page and notebook. Suspended items keep their history: suspension stops
// future reviews, it does not undo past ones.
export class DrizzleReviewHistoryReader implements ReviewHistoryReader {
  constructor(private readonly db: DbExecutor) {}

  async listReviews(
    ownerId: string,
    from: Date,
    to: Date,
  ): Promise<ReviewFact[]> {
    return this.db
      .select({
        pageId: pages.id,
        notebookId: notebooks.id,
        technique: reviewLogs.sessionKind,
        quality: reviewLogs.quality,
        reviewedAt: reviewLogs.reviewedAt,
      })
      .from(reviewLogs)
      .innerJoin(studyItems, eq(studyItems.id, reviewLogs.itemId))
      .innerJoin(pages, eq(pages.id, studyItems.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(
        and(
          eq(reviewLogs.ownerId, ownerId),
          gte(reviewLogs.reviewedAt, from),
          lt(reviewLogs.reviewedAt, to),
          ...livePage,
        ),
      )
      .orderBy(asc(reviewLogs.reviewedAt), asc(reviewLogs.id));
  }

  async listReviewBuckets(ownerId: string): Promise<ReviewBucket[]> {
    // 15-minute UTC buckets: every zone offset in use is a multiple of 15
    // minutes, so a bucket never spans two local days.
    const startsAt = sql`date_bin('15 minutes', ${reviewLogs.reviewedAt}, timestamptz '2000-01-01 00:00:00+00')`;
    return this.db
      .selectDistinct({
        technique: reviewLogs.sessionKind,
        startsAt: startsAt.mapWith(reviewLogs.reviewedAt),
      })
      .from(reviewLogs)
      .innerJoin(studyItems, eq(studyItems.id, reviewLogs.itemId))
      .innerJoin(pages, eq(pages.id, studyItems.pageId))
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .where(and(eq(reviewLogs.ownerId, ownerId), ...livePage))
      .orderBy(asc(startsAt), asc(reviewLogs.sessionKind));
  }
}
