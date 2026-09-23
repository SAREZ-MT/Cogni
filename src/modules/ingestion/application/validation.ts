import type { z } from "zod";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Same edge-parsing pattern as notebooks/application/validation.ts: Zod
// only rejects malformed input shape (type, presence). Domain functions
// still own every semantic rule (file size bounds, mime allow-list, path
// shape, upload expiry, ...).
export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T, DomainError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  const field = String(parsed.error.issues[0]?.path[0] ?? "input");
  return err(new DomainError("INGESTION_INVALID_INPUT", `invalid ${field}`));
}
