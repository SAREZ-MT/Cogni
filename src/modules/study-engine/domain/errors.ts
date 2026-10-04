// DomainError codes for the study-engine module. Application code maps
// every failure to one of these codes; nothing else leaves the module as an
// error shape (same convention as notebooks/domain/errors.ts).
export const STUDY_ENGINE_ERROR = {
  INVALID_QUALITY: "STUDY_ENGINE_INVALID_QUALITY",
  ITEM_NOT_FOUND: "STUDY_ENGINE_ITEM_NOT_FOUND",
  ITEM_SUSPENDED: "STUDY_ENGINE_ITEM_SUSPENDED",
} as const;
