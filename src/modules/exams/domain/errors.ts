// DomainError codes for the exams module. Application code maps every
// failure to one of these codes; nothing else leaves the module as an error
// shape (same convention as notebooks/domain/errors.ts).
export const EXAM_ERROR = {
  // A question's stem, options, correct index, explanation or concept is
  // blank, too long, duplicated or out of range.
  INVALID_QUESTION: "EXAMS_INVALID_QUESTION",
  // A retired question cannot be edited, retired again or varied.
  QUESTION_RETIRED: "EXAMS_QUESTION_RETIRED",
  // A variant must not repeat the wording of the question it replaces.
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
  // A session cannot be scored without answers.
  NO_ANSWERS: "EXAMS_NO_ANSWERS",
  // The session was already finished.
  SESSION_FINISHED: "EXAMS_SESSION_FINISHED",
} as const;
