// What deleting a page's exam set removes (Phase 8 H19), read just before
// the confirmation: its active questions and its attempts (exams taken or
// open).
export interface ExamSetDeletionPreview {
  questions: number;
  attempts: number;
}

// Port over the hard delete of a page's whole exam set (Phase 8 H19). Both
// answer null/false when the page is not the owner's. `delete` removes, in
// one transaction under the page lock, every question of the page (every
// lineage, retired ones too), every exam and answer, the page's exam
// state, the exams' AI feedback, the questions' study items and review
// logs and the set's generation fingerprints, then rewrites the page's
// mastery from what is left.
export interface ExamSetDeletion {
  preview(
    pageId: string,
    ownerId: string,
  ): Promise<ExamSetDeletionPreview | null>;
  delete(pageId: string, ownerId: string, now: Date): Promise<boolean>;
}
