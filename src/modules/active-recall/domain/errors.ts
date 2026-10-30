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
  // A session cannot start: the page has no active question to practise.
  NO_QUESTIONS: "RECALL_NO_QUESTIONS",
  // The owner has no such session.
  SESSION_NOT_FOUND: "RECALL_SESSION_NOT_FOUND",
  // An answer was sent to a session that already finished.
  SESSION_FINISHED: "RECALL_SESSION_FINISHED",
  // The question is unknown, another owner's or on another page than the
  // session's.
  QUESTION_NOT_IN_SESSION: "RECALL_QUESTION_NOT_IN_SESSION",
  // The owner has no such answer ("No estoy de acuerdo").
  ANSWER_NOT_FOUND: "RECALL_ANSWER_NOT_FOUND",
  // The owner has no such active question on the page (Phase 8 H18 edit
  // page).
  QUESTION_NOT_FOUND: "RECALL_QUESTION_NOT_FOUND",
  // Deleting it would leave the page without questions (Phase 8 H18: the
  // edit page keeps at least one; the whole set goes with a separate
  // action).
  LAST_QUESTION: "RECALL_LAST_QUESTION",
  // An edit page save over a newer change of the item (another tab saved
  // it after this page loaded; V10): nothing is written.
  CHANGED: "RECALL_QUESTION_CHANGED",
  // The owner has no such page to delete the recall set of (Phase 8 H19).
  SET_NOT_FOUND: "RECALL_SET_NOT_FOUND",
  // "Generar" found no paragraph active recall has not used yet on the page
  // (Phase 6 T5c incremental generation): no AI call, no unit consumed.
  NO_NEW_CONTENT: "RECALL_NO_NEW_CONTENT",
  // A Server Action was called without a signed-in user.
  SESSION_REQUIRED: "RECALL_SESSION_REQUIRED",
  // A Server Action input failed its Zod validation.
  INVALID_INPUT: "RECALL_INVALID_INPUT",
  // A Server Action hit an unexpected failure (reported to Sentry).
  UNEXPECTED: "RECALL_UNEXPECTED",
} as const;
