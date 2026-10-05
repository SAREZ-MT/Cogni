// DomainError codes for the exams module. Application code maps every
// failure to one of these codes; nothing else leaves the module as an error
// shape (same convention as notebooks/domain/errors.ts).
export const EXAM_ERROR = {
  // A question's stem, options, correct index, explanation or concept is
  // blank, too long, duplicated or out of range.
  INVALID_QUESTION: "EXAMS_INVALID_QUESTION",
  // A retired question cannot be edited, retired again or varied.
  QUESTION_RETIRED: "EXAMS_QUESTION_RETIRED",
  // A variant must not repeat any earlier wording of its root's lineage.
  VARIANT_SAME_WORDING: "EXAMS_VARIANT_SAME_WORDING",
  // The requested number of questions is outside [EXAM_MIN_QUESTIONS,
  // EXAM_MAX_QUESTIONS] or below the number of failed roots of a retake.
  INVALID_QUESTION_COUNT: "EXAMS_INVALID_QUESTION_COUNT",
  // The page has fewer active roots than EXAM_MIN_QUESTIONS.
  NOT_ENOUGH_QUESTIONS: "EXAMS_NOT_ENOUGH_QUESTIONS",
  // A retake was requested but the page has no failed roots.
  NO_RETAKE_PENDING: "EXAMS_NO_RETAKE_PENDING",
  // A failed root has no fresh variant: the retake is blocked (§7.5.5).
  RETAKE_VARIANT_MISSING: "EXAMS_RETAKE_VARIANT_MISSING",
  // An answer's selected index is out of range or belongs to another session.
  INVALID_ANSWER: "EXAMS_INVALID_ANSWER",
  // Two answers in one session share a question or a root.
  DUPLICATE_ANSWER: "EXAMS_DUPLICATE_ANSWER",
  // A finish before the session's start, or with more answers than the
  // requested number of questions.
  INVALID_SESSION_FINISH: "EXAMS_INVALID_SESSION_FINISH",
  // A session cannot be scored or finished without answers.
  NO_ANSWERS: "EXAMS_NO_ANSWERS",
  // The session was already finished.
  SESSION_FINISHED: "EXAMS_SESSION_FINISHED",
  // The owner has no such question (missing or another owner's).
  QUESTION_NOT_FOUND: "EXAMS_QUESTION_NOT_FOUND",
  // Server Action boundary: no signed-in user, input rejected by the
  // schema, or an unexpected failure (logged, never shown raw).
  SESSION_REQUIRED: "EXAMS_SESSION_REQUIRED",
  INVALID_INPUT: "EXAMS_INVALID_INPUT",
  UNEXPECTED: "EXAMS_UNEXPECTED",
} as const;
