// DomainError is the only error shape domain and application code produce.
// Infrastructure translates external exceptions into a DomainError at the
// edge; it never leaks driver-specific exceptions upward (documento-maestro
// §12).

export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}

// The plain, structurally-serializable shape a DomainError degrades to once
// it crosses a Next.js Server Action (RSC/Flight) boundary: React redacts
// Error subclasses on the wire (a generic digest-bearing Error in
// production, at best a plain object client-side), so `error instanceof
// DomainError` is never true again once the client receives it. Server
// Actions that return a Result to the client (notebooks/actions.ts's
// saveContent/getCurrentContent) map their DomainError to this shape with
// toActionError() before returning, and callers on the client use
// isDomainErrorLike() — a shape check, not an instanceof check — to read
// it back (root cause of the autosave conflict-reconciliation bug: see
// use-autosave.ts).
export interface ActionError {
  readonly code: string;
  readonly message: string;
}

export function toActionError(error: DomainError): ActionError {
  return { code: error.code, message: error.message };
}

// True for a real DomainError instance (in-process callers, e.g. fakes in
// tests) AND for the plain { code, message } shape toActionError() produces
// (post-boundary callers) — a DomainError instance already has both
// properties, so this subsumes isDomainError() for every caller that only
// needs the shape, not the exact class.
export function isDomainErrorLike(value: unknown): value is ActionError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}
