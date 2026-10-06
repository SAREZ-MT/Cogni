// DomainError codes for the active-recall module. Application code maps
// every failure to one of these codes; nothing else leaves the module as an
// error shape (same convention as exams/domain/errors.ts).
export const RECALL_ERROR = {
  // A question's prompt is blank, its rubric has no key concept, a blank
  // concept or a blank answer summary, or its origin and generation id
  // disagree.
  INVALID_QUESTION: "RECALL_INVALID_QUESTION",
  // An AI score or a self-rating is not an integer in [0, 5].
  INVALID_SCORE: "RECALL_INVALID_SCORE",
  // An answer's self-rating is not an integer in [0, 5].
  INVALID_ANSWER: "RECALL_INVALID_ANSWER",
  // A Server Action was called without a signed-in user.
  SESSION_REQUIRED: "RECALL_SESSION_REQUIRED",
  // A Server Action input failed its Zod validation.
  INVALID_INPUT: "RECALL_INVALID_INPUT",
  // A Server Action hit an unexpected failure (reported to Sentry).
  UNEXPECTED: "RECALL_UNEXPECTED",
} as const;
