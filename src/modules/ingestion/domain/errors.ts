// DomainError codes for this module (design.md, "Decision: Entidad
// ImportJob y transiciones de la spec"). Every invalid transition — from a
// terminal state, `fail` from `queued` with a kind other than `timeout`,
// `complete` with invalid counts, `fail` with an empty message — maps to
// this single code, exactly as design.md specifies.
export const IMPORT_JOB_ERROR = {
  INVALID_TRANSITION: "IMPORT_JOB_INVALID_TRANSITION",
} as const;
