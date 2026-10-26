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

// DomainError codes for `document-file.ts` (design.md, `errors.ts` code
// list; `PDF_*` renamed to `DOCUMENT_*` when document-import T5 widened the
// import from PDF to PDF/DOCX/PPTX — no code is persisted, so the rename
// only touches this module and its UI copy).
// `MIME_NOT_ALLOWED`/`TOO_LARGE`/`FILE_NAME_INVALID` are raised by the pure
// validators (`validateDocumentInput`/`validateFileName`).
// `PATH_OUT_OF_SCOPE`, `UPLOAD_EXPIRED`, `OBJECT_MISSING` and `UNREADABLE`
// are raised by the application layer (`startPdfImport`,
// `processImportJob`) from the boolean/number results
// `isOwnedDocumentPath`/`uploadIdAgeMs` return and from `PdfStorageGateway`
// calls, and by the `DocumentExtractor` adapters (`UNREADABLE`).
// `UNSUPPORTED_FORMAT` (T5): the stored object's real mime does not match
// the format its path declares (`startPdfImport`), or a `DocumentExtractor`
// has no adapter for the format (`FormatRoutingDocumentExtractor`).
// `LIMIT_EXCEEDED` (T9b): the document is readable but bigger or more
// complex than the import accepts (OOXML part/total/ratio/entry caps, XML
// element or nesting caps, PDF page or text caps). `processImportJob`
// maps it to `invalid_document` with `DOCUMENT_LIMIT_EXCEEDED_MESSAGE`.
export const DOCUMENT_FILE_ERROR = {
  MIME_NOT_ALLOWED: "DOCUMENT_MIME_NOT_ALLOWED",
  TOO_LARGE: "DOCUMENT_TOO_LARGE",
  FILE_NAME_INVALID: "DOCUMENT_FILE_NAME_INVALID",
  PATH_OUT_OF_SCOPE: "DOCUMENT_PATH_OUT_OF_SCOPE",
  UPLOAD_EXPIRED: "DOCUMENT_UPLOAD_EXPIRED",
  OBJECT_MISSING: "DOCUMENT_OBJECT_MISSING",
  UNREADABLE: "DOCUMENT_UNREADABLE",
  UNSUPPORTED_FORMAT: "DOCUMENT_UNSUPPORTED_FORMAT",
  LIMIT_EXCEEDED: "DOCUMENT_LIMIT_EXCEEDED",
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
// `SESSION_REQUIRED` is T8's addition (design.md, `errors.ts` code list):
// raised only by `ingestion/actions.ts`, the only layer that resolves a
// session, mirroring `NOTEBOOKS_ERROR.SESSION_REQUIRED`.
// `STORAGE_UNAVAILABLE` is T8's addition (T7c review follow-up: a thrown
// `PdfStorageGateway` call — `createSignedUploadUrl` in `requestPdfUpload`,
// `getObjectMetadata` in `startPdfImport` — must resolve to a typed
// failure instead of propagating an exception out of the use case).
// `UNEXPECTED` is T10's addition (T8 review follow-up:
// R3-actions-never-throw-unenforced): the boundary `try/catch` every
// Server Action in `actions.ts` wraps its body in maps any exception a
// dependency throws (`getCurrentUser`, a use case, an adapter) to this
// code instead of ever letting it escape to the client.
// `RATE_LIMITED` is T9b's addition (security audit: import rate limit):
// raised by `requestPdfUpload`/`startPdfImport` when the owner spent the
// hourly limit or already has MAX_ACTIVE_IMPORTS imports in flight.
export const INGESTION_ERROR = {
  NOTEBOOK_NOT_FOUND: "INGESTION_NOTEBOOK_NOT_FOUND",
  NOTEBOOK_MISMATCH: "INGESTION_NOTEBOOK_MISMATCH",
  PAGE_NOT_FOUND: "INGESTION_PAGE_NOT_FOUND",
  SESSION_REQUIRED: "INGESTION_SESSION_REQUIRED",
  STORAGE_UNAVAILABLE: "INGESTION_STORAGE_UNAVAILABLE",
  UNEXPECTED: "INGESTION_UNEXPECTED",
  RATE_LIMITED: "INGESTION_RATE_LIMITED",
} as const;
