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
