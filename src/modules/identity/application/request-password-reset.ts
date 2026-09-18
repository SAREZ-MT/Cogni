import { z } from "zod";
import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { AuthGateway } from "../domain/auth-gateway";
import { emailSchema, parseInput } from "./credentials-schema";
import { AUTH_CALLBACK_PATH } from "./sign-up";

export const RESET_PASSWORD_PATH = "/reset-password";

// The gateway answers the same for known and unknown emails, so this use
// case cannot leak account existence either.
export async function requestPasswordReset(
  input: unknown,
  deps: { auth: AuthGateway; siteUrl: string },
): Promise<Result<void, DomainError>> {
  const parsed = parseInput(z.object({ email: emailSchema }), input);
  if (!parsed.ok) return parsed;

  return deps.auth.requestPasswordReset({
    email: parsed.value.email,
    redirectTo: `${deps.siteUrl}${AUTH_CALLBACK_PATH}?next=${RESET_PASSWORD_PATH}`,
  });
}
