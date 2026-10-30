import { and, eq } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { pageMastery } from "@/shared/db/schema";
import { computeMastery } from "../domain/mastery";
import { DrizzlePageMasteryRepository } from "./drizzle-page-mastery-repository";
import { DrizzleStudyItemRepository } from "./drizzle-study-item-repository";

// Phase 8 H19: rewrites a page's mastery right after a technique set was
// deleted from it, from the items it still has (same computation as a
// grade and the daily job). A page left with no item loses its mastery
// row, like a page never studied. `db` is the deleting transaction.
export async function refreshPageMastery(
  db: DbExecutor,
  input: { pageId: string; ownerId: string; now: Date; id: string },
): Promise<void> {
  const items = await new DrizzleStudyItemRepository(db).listByPage(
    input.pageId,
    input.ownerId,
  );
  if (items.length === 0) {
    await db
      .delete(pageMastery)
      .where(
        and(
          eq(pageMastery.pageId, input.pageId),
          eq(pageMastery.ownerId, input.ownerId),
        ),
      );
    return;
  }
  await new DrizzlePageMasteryRepository(db).upsert({
    id: input.id,
    ownerId: input.ownerId,
    pageId: input.pageId,
    ...computeMastery(items, input.now),
    computedAt: input.now,
  });
}
