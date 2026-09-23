// DomainError codes for this module (design.md, "Decision: Entidad
// ImportJob y transiciones de la spec"). Every invalid transition — from a
// terminal state, `fail` from `queued` with a kind other than `timeout`,
// `complete` with invalid counts, `fail` with an empty message — maps to
// this single code, exactly as design.md specifies. `NOT_FOUND` is raised
// by the application layer (T6's `processImportJob`/`getImportJobStatus`),
// never by `import-job.ts` itself.
// `STORAGE_PATH_CONFLICT` is T6's addition (review follow-up from T5:
// R3-idempotency-check-then-act-race): `ImportJobRepository.create`
// returns this instead of throwing when a job with the same `storage_path`
// already exists (the DB unique constraint since T1), so `startPdfImport`
// can resolve the race by re-fetching the winning job instead of leaking
// an exception after the page was already created.
export const IMPORT_JOB_ERROR = {
  INVALID_TRANSITION: "IMPORT_JOB_INVALID_TRANSITION",
  NOT_FOUND: "IMPORT_JOB_NOT_FOUND",
  STORAGE_PATH_CONFLICT: "IMPORT_JOB_STORAGE_PATH_CONFLICT",
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
// `NOTEBOOK_MISMATCH` is T6's addition (review follow-up from T5:
// R3-idempotent-notebookid-echoed-from-input): raised by `startPdfImport`
// on its idempotent path (a repeated call for a `storagePath` that already
// has a job) when the caller's `notebookId` does not match the notebook
// the existing job's page actually lives in, instead of blindly echoing
// back whatever `notebookId` the caller supplied.
// `PAGE_NOT_FOUND` is T7b's addition (review follow-up from T6:
// R3-idempotent-null-page-reported-as-mismatch): the same idempotent path
// raises this instead of `NOTEBOOK_MISMATCH` when
// `NotebookPagesPort.findPageNotebookId` returns null — the existing job's
// page is missing, archived or no longer owned by the caller, which is a
// different failure than a `notebookId` that simply no longer matches.
export const INGESTION_ERROR = {
  NOTEBOOK_NOT_FOUND: "INGESTION_NOTEBOOK_NOT_FOUND",
  NOTEBOOK_MISMATCH: "INGESTION_NOTEBOOK_MISMATCH",
  PAGE_NOT_FOUND: "INGESTION_PAGE_NOT_FOUND",
} as const;
