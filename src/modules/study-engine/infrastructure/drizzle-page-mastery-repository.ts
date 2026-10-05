import { and, asc, eq } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { type PageMasteryRow, pageMastery } from "@/shared/db/schema";
import type { PageMastery } from "../domain/page-mastery";
import type { PageMasteryRepository } from "../domain/page-mastery-repository";

function toPageMastery(row: PageMasteryRow): PageMastery {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    level: row.level,
    score: row.score,
    itemsTotal: row.itemsTotal,
    itemsDue: row.itemsDue,
    computedAt: row.computedAt,
  };
}

// Drizzle implementation of PageMasteryRepository; one row per page
// (page_mastery_page_id_key), every query filters by owner_id.
export class DrizzlePageMasteryRepository implements PageMasteryRepository {
  constructor(private readonly db: DbExecutor) {}

  async upsert(mastery: PageMastery): Promise<void> {
    const values = {
      level: mastery.level,
      score: mastery.score,
      itemsTotal: mastery.itemsTotal,
      itemsDue: mastery.itemsDue,
      computedAt: mastery.computedAt,
      updatedAt: mastery.computedAt,
    };
    // The row keeps its first id; the WHERE on the conflict branch never
    // lets another owner overwrite it.
    await this.db
      .insert(pageMastery)
      .values({
        id: mastery.id,
        ownerId: mastery.ownerId,
        pageId: mastery.pageId,
        createdAt: mastery.computedAt,
        ...values,
      })
      .onConflictDoUpdate({
        target: pageMastery.pageId,
        set: values,
        setWhere: eq(pageMastery.ownerId, mastery.ownerId),
      });
  }

  async getByPage(
    pageId: string,
    ownerId: string,
  ): Promise<PageMastery | null> {
    const [row] = await this.db
      .select()
      .from(pageMastery)
      .where(
        and(eq(pageMastery.pageId, pageId), eq(pageMastery.ownerId, ownerId)),
      );
    return row ? toPageMastery(row) : null;
  }

  async listByOwner(ownerId: string): Promise<PageMastery[]> {
    const rows = await this.db
      .select()
      .from(pageMastery)
      .where(eq(pageMastery.ownerId, ownerId))
      .orderBy(asc(pageMastery.pageId));
    return rows.map(toPageMastery);
  }
}
