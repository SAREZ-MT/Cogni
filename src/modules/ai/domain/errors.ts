// DomainError codes for the ai module. Application maps every failure to one
// of these; nothing else leaves the module as an error shape.
export const AI_ERROR = {
  NO_PROVIDER_AVAILABLE: "AI_NO_PROVIDER_AVAILABLE",
  DAILY_LIMIT_REACHED: "AI_DAILY_LIMIT_REACHED",
  GENERATION_FAILED: "AI_GENERATION_FAILED",
  PAGE_EMPTY: "AI_PAGE_EMPTY",
  INVALID_TRANSITION: "AI_INVALID_TRANSITION",
} as const;
