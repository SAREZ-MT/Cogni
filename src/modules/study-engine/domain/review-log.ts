import type { Quality } from "./study-item";

// One row per graded answer (§6.1). session_id points to the
// FlashcardSession, ExamSession or RecallSession named by sessionKind.
export type SessionKind = "flashcards" | "exam" | "recall";

export interface ReviewLog {
  readonly id: string;
  readonly ownerId: string;
  readonly itemId: string;
  readonly quality: Quality;
  readonly reviewedAt: Date;
  readonly intervalBefore: number;
  readonly intervalAfter: number;
  readonly easinessAfter: number;
  readonly sessionKind: SessionKind;
  readonly sessionId: string;
}
