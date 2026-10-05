import { and, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { examPageState, pages } from "@/shared/db/schema";
import type { ExamPageStateRepository } from "../domain/exam-page-state-repository";
import type { ExamPageState } from "../domain/exam-session";

// Drizzle implementation of ExamPageStateRepository; every query filters by
// owner_id (documento-maestro §6.1). `db` may be an open transaction.
export class DrizzleExamPageStateRepository implements ExamPageStateRepository {
  constructor(private readonly db: DbExecutor) {}

  async get(pageId: string, ownerId: string): Promise<ExamPageState | null> {
    const [row] = await this.db
      .select({
        pageId: examPageState.pageId,
        ownerId: examPageState.ownerId,
        retakePending: examPageState.retakePending,
        failedRootIds: examPageState.failedRootIds,
        lastPassedSessionId: examPageState.lastPassedSessionId,
      })
      .from(examPageState)
      .where(
        and(
          eq(examPageState.pageId, pageId),
          eq(examPageState.ownerId, ownerId),
        ),
      );
    return row ?? null;
  }

  async upsert(state: ExamPageState): Promise<void> {
    const values = {
      retakePending: state.retakePending,
      failedRootIds: [...state.failedRootIds],
      lastPassedSessionId: state.lastPassedSessionId,
      updatedAt: new Date(),
    };
    // One statement: the insert selects from pages, so a page that is not
    // the owner's inserts nothing; the WHERE on the conflict branch makes an
    // upsert over another owner's row a no-op instead of a takeover.
    await this.db
      .insert(examPageState)
      .select(
        this.db
          .select({
            pageId: pages.id,
            ownerId: pages.ownerId,
            retakePending: sql<boolean>`${values.retakePending}`.as(
              "retake_pending",
            ),
            failedRootIds: sql<string[]>`${JSON.stringify(
              values.failedRootIds,
            )}::jsonb`.as("failed_root_ids"),
            lastPassedSessionId: sql<
              string | null
            >`${values.lastPassedSessionId}::uuid`.as("last_passed_session_id"),
            createdAt: sql<Date>`now()`.as("created_at"),
            updatedAt: sql<Date>`now()`.as("updated_at"),
          })
          .from(pages)
          .where(
            and(eq(pages.id, state.pageId), eq(pages.ownerId, state.ownerId)),
          ),
      )
      .onConflictDoUpdate({
        target: examPageState.pageId,
        set: values,
        setWhere: eq(examPageState.ownerId, state.ownerId),
      });
  }
}
