import type { ExamPageState } from "./exam-session";

// One ExamPageState per page (documento-maestro §6.1); owner-scoped.
export interface ExamPageStateRepository {
  // Null when the page has no exam history yet (initialExamPageState).
  get(pageId: string, ownerId: string): Promise<ExamPageState | null>;
  // Inserts the page's state or overwrites it. Never takes over another
  // owner's row and never writes a page that is not the owner's: such an
  // upsert is a no-op.
  upsert(state: ExamPageState): Promise<void>;
}
