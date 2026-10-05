import { and, asc, eq, isNull, lt, or, type SQL, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { pageMastery, studyItems } from "@/shared/db/schema";
import type {
  StalePagesQuery,
  StudiedPage,
  StudiedPageReader,
} from "../domain/studied-page-reader";

// computed_at truncated to the millisecond a JS Date holds, so the value
// handed back as a cursor compares exactly against the stored one.
const computedAtMs = sql`date_trunc('milliseconds', ${pageMastery.computedAt})`;
// The keyset's first column: pages without mastery sort as the epoch,
// before any real computed_at.
const sortKey = sql`coalesce(${computedAtMs}, 'epoch'::timestamptz)`;

// Drizzle implementation of StudiedPageReader. Deliberately not
// owner-filtered; only the daily mastery job uses it. study_items grouped
// by page_id (one row per page, so the keyset cannot split a page), left
// joined to the page's page_mastery row (unique per page_id). The HAVING
// clause encodes the single-owner invariant: a page whose items disagree on
// the owner is never listed, so the job never recomputes it for the wrong
// owner.
export class DrizzleStudiedPageReader implements StudiedPageReader {
  constructor(private readonly db: DbExecutor) {}

  async listStalePages(query: StalePagesQuery): Promise<StudiedPage[]> {
    const conditions: SQL[] = [
      or(
        isNull(pageMastery.computedAt),
        lt(pageMastery.computedAt, query.staleBefore),
      ) as SQL,
    ];
    if (query.after !== null) {
      const afterAt = (
        query.after.masteryComputedAt ?? new Date(0)
      ).toISOString();
      conditions.push(
        sql`(${sortKey}, ${studyItems.pageId}) > (${afterAt}::timestamptz, ${query.after.pageId}::uuid)`,
      );
    }

    return this.db
      .select({
        pageId: studyItems.pageId,
        ownerId: sql<string>`min(${studyItems.ownerId}::text)`,
        masteryComputedAt: sql<Date | null>`${computedAtMs}`.mapWith(
          pageMastery.computedAt,
        ),
      })
      .from(studyItems)
      .leftJoin(pageMastery, eq(pageMastery.pageId, studyItems.pageId))
      .where(and(...conditions))
      .groupBy(studyItems.pageId, pageMastery.computedAt)
      .having(sql`count(distinct ${studyItems.ownerId}) = 1`)
      .orderBy(asc(sortKey), asc(studyItems.pageId))
      .limit(query.limit);
  }
}
