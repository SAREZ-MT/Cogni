import { and, eq } from "drizzle-orm";
import type { DbExecutor } from "@/shared/db/client";
import { examPageState } from "@/shared/db/schema";
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
    // The WHERE on the conflict branch makes an upsert with another owner's
    // page a no-op instead of a takeover.
    await this.db
      .insert(examPageState)
      .values({ pageId: state.pageId, ownerId: state.ownerId, ...values })
      .onConflictDoUpdate({
        target: examPageState.pageId,
        set: values,
        setWhere: eq(examPageState.ownerId, state.ownerId),
      });
  }
}
