// Server-side factory other modules use to persist study items inside their
// own unit of work (flashcards' DrizzleDeckUnitOfWork). Same role as
// notebooks/server-api.ts: a composition root without "use server", reached
// only through this module's index.ts.
import type { DbExecutor } from "@/shared/db/client";
import type { StudyItemRepository } from "./domain/study-item-repository";
import { DrizzleStudyItemRepository } from "./infrastructure";

// `db` may be an open transaction, so the items join the caller's commit.
export function createStudyItemRepository(db: DbExecutor): StudyItemRepository {
  return new DrizzleStudyItemRepository(db);
}
