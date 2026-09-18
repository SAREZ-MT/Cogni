import { z } from "zod";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { AUTH_ERROR } from "../domain/auth-errors";

export const PASSWORD_MIN_LENGTH = 8;

export const emailSchema = z.string().trim().pipe(z.email());
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH);

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Zod runs at the application edge; the UI never sees Zod issues, only
// the AUTH_INVALID_INPUT code plus which field failed.
export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T, DomainError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  const field = String(parsed.error.issues[0]?.path[0] ?? "input");
  return err(new DomainError(AUTH_ERROR.INVALID_INPUT, `invalid ${field}`));
}
