import type { TechniqueSnapshot } from "./technique-overview";

export interface TechniqueSnapshotBounds {
  // Start of the owner's local today: reviews logged at or after it (and
  // before `dueBefore`) are today's.
  reviewedFrom: Date;
  // Start of the owner's local tomorrow: items due before it are due
  // today; the next due date is the earliest due_at at or after it.
  dueBefore: Date;
}

// Read port behind Home's technique cards. Owner-scoped. Per technique:
// counts every live item (not suspended, page and notebook not archived,
// any due date), takes the earliest due_at at or after `dueBefore`, lists
// the distinct live pages with an item due before `dueBefore`, and the
// distinct live pages (page and notebook not archived) with a review log
// of that technique (review_logs.session_kind, REVIEW_SESSION_KIND) in
// [reviewedFrom, dueBefore). A technique without items reads
// { total: 0, nextDueAt: null, duePageIds: [], reviewedPageIds: [] }.
export interface TechniqueOverviewReader {
  readTechniqueSnapshot(
    ownerId: string,
    bounds: TechniqueSnapshotBounds,
  ): Promise<TechniqueSnapshot>;
}
