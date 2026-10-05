import { asc, gt } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { studyItems } from "@/shared/db/schema";
import type {
  StudiedPage,
  StudiedPageReader,
} from "../domain/studied-page-reader";

// Drizzle implementation of StudiedPageReader: the distinct (page, owner)
// pairs of study_items, keyset-paginated by page_id. Deliberately not
// owner-filtered; only the daily mastery job uses it.
export class DrizzleStudiedPageReader implements StudiedPageReader {
  constructor(private readonly db: DbExecutor) {}

  async listStudiedPages(
    afterPageId: string | null,
    limit: number,
  ): Promise<StudiedPage[]> {
    return this.db
      .selectDistinct({
        pageId: studyItems.pageId,
        ownerId: studyItems.ownerId,
      })
      .from(studyItems)
      .where(
        afterPageId === null ? undefined : gt(studyItems.pageId, afterPageId),
      )
      .orderBy(asc(studyItems.pageId), asc(studyItems.ownerId))
      .limit(limit);
  }
}
