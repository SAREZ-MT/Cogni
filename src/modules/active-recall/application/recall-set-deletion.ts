// What deleting a page's recall set removes (Phase 8 H19), read just
// before the confirmation: its active questions and its sessions.
export interface RecallSetDeletionPreview {
  questions: number;
  sessions: number;
}

// Port over the hard delete of a page's whole recall set (Phase 8 H19).
// Both answer null/false when the page is not the owner's. `delete`
// removes, in one transaction under the page lock, every question of the
// page (archived ones too), every session and answer, the sessions' AI
// feedback, the questions' study items and review logs and the set's
// generation fingerprints, then rewrites the page's mastery from what is
// left.
export interface RecallSetDeletion {
  preview(
    pageId: string,
    ownerId: string,
  ): Promise<RecallSetDeletionPreview | null>;
  delete(pageId: string, ownerId: string, now: Date): Promise<boolean>;
}
