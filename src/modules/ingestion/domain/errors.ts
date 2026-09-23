// DomainError codes for this module (design.md, "Decision: Entidad
// ImportJob y transiciones de la spec"). Every invalid transition — from a
// terminal state, `fail` from `queued` with a kind other than `timeout`,
// `complete` with invalid counts, `fail` with an empty message — maps to
// this single code, exactly as design.md specifies.
export const IMPORT_JOB_ERROR = {
  INVALID_TRANSITION: "IMPORT_JOB_INVALID_TRANSITION",
} as const;

// DomainError codes for `pdf-file.ts` (design.md, `errors.ts` code list).
// Only the three codes raised by this task's pure validators live here;
// PDF_PATH_OUT_OF_SCOPE, PDF_UPLOAD_EXPIRED, PDF_OBJECT_MISSING,
// PDF_UNREADABLE, IMPORT_JOB_NOT_FOUND and INGESTION_SESSION_REQUIRED are
// raised by the application layer (T5/T6) from the boolean/number results
// `isOwnedPdfPath`/`uploadIdAgeMs` return, not from inside `pdf-file.ts`.
export const PDF_FILE_ERROR = {
  MIME_NOT_ALLOWED: "PDF_MIME_NOT_ALLOWED",
  TOO_LARGE: "PDF_TOO_LARGE",
  FILE_NAME_INVALID: "PDF_FILE_NAME_INVALID",
} as const;
