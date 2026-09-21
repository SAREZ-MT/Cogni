import type { z } from "zod";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Zod runs at the application edge, same pattern as identity's
// credentials-schema.ts. Domain still owns semantic rules (title length,
// color palette, ...); this only rejects malformed input shape.
export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T, DomainError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  const field = String(parsed.error.issues[0]?.path[0] ?? "input");
  return err(new DomainError("NOTEBOOKS_INVALID_INPUT", `invalid ${field}`));
}
