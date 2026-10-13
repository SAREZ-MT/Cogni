import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { notebooks, pageMastery, pages, studyItems } from "@/shared/db/schema";
import type { PageProgressRow } from "../domain/progress";
import type { PageProgressReader } from "../domain/readers";
import { livePage } from "./live-pages";

// One grouped query: every live page of the owner with its notebook, its
// page_mastery row (left join: a page never reviewed has none) and its
// live item counts. Counting due items here instead of reading
// page_mastery.items_due keeps "vencidos" equal to the calendar's "Hoy"
// between mastery recomputations.
export class DrizzlePageProgressReader implements PageProgressReader {
  constructor(private readonly db: DbExecutor) {}

  async listPageProgress(
    ownerId: string,
    now: Date,
  ): Promise<PageProgressRow[]> {
    const active = sql`${studyItems.suspendedAt} is null`;
    const rows = await this.db
      .select({
        pageId: pages.id,
        pageTitle: pages.title,
        notebookId: notebooks.id,
        notebookTitle: notebooks.title,
        notebookColor: notebooks.color,
        level: pageMastery.level,
        score: pageMastery.score,
        itemsTotal:
          sql<number>`count(${studyItems.id}) filter (where ${active})`.mapWith(
            Number,
          ),
        itemsDue:
          sql<number>`count(${studyItems.id}) filter (where ${active} and ${lte(studyItems.dueAt, now)})`.mapWith(
            Number,
          ),
      })
      .from(pages)
      .innerJoin(notebooks, eq(notebooks.id, pages.notebookId))
      .leftJoin(pageMastery, eq(pageMastery.pageId, pages.id))
      .leftJoin(studyItems, eq(studyItems.pageId, pages.id))
      .where(and(eq(pages.ownerId, ownerId), ...livePage))
      .groupBy(pages.id, notebooks.id, pageMastery.id)
      .orderBy(
        asc(notebooks.position),
        asc(notebooks.id),
        asc(pages.position),
        asc(pages.id),
      );
    return rows;
  }
}
