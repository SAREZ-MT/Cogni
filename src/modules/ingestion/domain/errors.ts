// DomainError codes for this module (design.md, "Decision: Entidad
// ImportJob y transiciones de la spec"). Every invalid transition — from a
// terminal state, `fail` from `queued` with a kind other than `timeout`,
// `complete` with invalid counts, `fail` with an empty message — maps to
// this single code, exactly as design.md specifies. `NOT_FOUND` is raised
// by the application layer (T6's `processImportJob`/`getImportJobStatus`),
// never by `import-job.ts` itself.
export const IMPORT_JOB_ERROR = {
  INVALID_TRANSITION: "IMPORT_JOB_INVALID_TRANSITION",
  NOT_FOUND: "IMPORT_JOB_NOT_FOUND",
} as const;

// DomainError codes for `pdf-file.ts` (design.md, `errors.ts` code list).
// `MIME_NOT_ALLOWED`/`TOO_LARGE`/`FILE_NAME_INVALID` are raised by this
// task's pure validators (`validatePdfInput`/`validateFileName`).
// `PATH_OUT_OF_SCOPE`, `UPLOAD_EXPIRED`, `OBJECT_MISSING` and `UNREADABLE`
// are raised by the application layer (T5's `startPdfImport`, T6's
// `processImportJob`) from the boolean/number results
// `isOwnedPdfPath`/`uploadIdAgeMs` return and from `PdfStorageGateway`
// calls — never from inside `pdf-file.ts`.
export const PDF_FILE_ERROR = {
  MIME_NOT_ALLOWED: "PDF_MIME_NOT_ALLOWED",
  TOO_LARGE: "PDF_TOO_LARGE",
  FILE_NAME_INVALID: "PDF_FILE_NAME_INVALID",
  PATH_OUT_OF_SCOPE: "PDF_PATH_OUT_OF_SCOPE",
  UPLOAD_EXPIRED: "PDF_UPLOAD_EXPIRED",
  OBJECT_MISSING: "PDF_OBJECT_MISSING",
  UNREADABLE: "PDF_UNREADABLE",
} as const;

// DomainError codes owned by `application` that are not specific to a PDF
// file or an ImportJob. `NOTEBOOK_NOT_FOUND` covers both "does not exist"
// and "archived", mirroring `findActiveNotebook`'s null result (design.md
// does not name an explicit code for this branch; deviation recorded in
// T5's task report). `SESSION_REQUIRED` mirrors
// `NOTEBOOKS_ERROR.SESSION_REQUIRED` and is added by T8's `actions.ts`,
// which is the only layer that resolves a session.
export const INGESTION_ERROR = {
  NOTEBOOK_NOT_FOUND: "INGESTION_NOTEBOOK_NOT_FOUND",
} as const;
