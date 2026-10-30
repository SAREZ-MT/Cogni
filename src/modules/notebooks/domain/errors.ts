// DomainError codes for this module (design.md, "Interfaces / Contracts").
// notebooks/application maps every failure to one of these codes; nothing
// else leaves the module as an error shape.
// Session-related errors, module-wide (not scoped to notebooks or pages).
export const NOTEBOOKS_ERROR = {
  SESSION_REQUIRED: "NOTEBOOKS_SESSION_REQUIRED",
  // A Server Action hit an unexpected failure (reported to Sentry).
  UNEXPECTED: "NOTEBOOKS_UNEXPECTED",
} as const;

export const NOTEBOOK_ERROR = {
  NOT_FOUND: "NOTEBOOK_NOT_FOUND",
  ARCHIVED: "NOTEBOOK_ARCHIVED",
  INVALID_TITLE: "NOTEBOOK_INVALID_TITLE",
  INVALID_COLOR: "NOTEBOOK_INVALID_COLOR",
} as const;

export const PAGE_ERROR = {
  NOT_FOUND: "PAGE_NOT_FOUND",
  VERSION_CONFLICT: "PAGE_VERSION_CONFLICT",
  INVALID_CONTENT: "PAGE_INVALID_CONTENT",
} as const;

export const ASSET_ERROR = {
  MIME_NOT_ALLOWED: "ASSET_MIME_NOT_ALLOWED",
  TOO_LARGE: "ASSET_TOO_LARGE",
  PATH_OUT_OF_SCOPE: "ASSET_PATH_OUT_OF_SCOPE",
  FORBIDDEN: "ASSET_FORBIDDEN",
  // document-import T9: Storage rejected a server-side upload.
  UPLOAD_FAILED: "ASSET_UPLOAD_FAILED",
} as const;
