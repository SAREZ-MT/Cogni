// DomainError codes for the study-engine module. Application code maps
// every failure to one of these codes; nothing else leaves the module as an
// error shape (same convention as notebooks/domain/errors.ts).
export const STUDY_ENGINE_ERROR = {
  INVALID_QUALITY: "STUDY_ENGINE_INVALID_QUALITY",
  ITEM_NOT_FOUND: "STUDY_ENGINE_ITEM_NOT_FOUND",
  ITEM_SUSPENDED: "STUDY_ENGINE_ITEM_SUSPENDED",
  // The item is not due yet (it was already graded, e.g. a double submit).
  ITEM_NOT_DUE: "STUDY_ENGINE_ITEM_NOT_DUE",
  // A review session was requested but no item is due.
  NOTHING_DUE: "STUDY_ENGINE_NOTHING_DUE",
  // A batch of exam reviews answers one root twice.
  INVALID_REVIEW_BATCH: "STUDY_ENGINE_INVALID_REVIEW_BATCH",
  SESSION_NOT_FOUND: "STUDY_ENGINE_SESSION_NOT_FOUND",
  SESSION_FINISHED: "STUDY_ENGINE_SESSION_FINISHED",
} as const;
