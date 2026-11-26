import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, type Result } from "@/shared/kernel/result";
import { AUTH_ERROR } from "../domain/auth-errors";
import type { AuthGateway } from "../domain/auth-gateway";
import { isFreshRecoverySession } from "../domain/password-change";
import { parseInput, passwordSchema } from "./credentials-schema";

// The reset page's form. A valid session is not enough to set a password:
// it must have been opened by a recent recovery link
// (domain/password-change.ts), and a session that cannot be read is refused.
export async function updatePassword(
  input: unknown,
  deps: { auth: AuthGateway; clock: Clock },
): Promise<Result<void, DomainError>> {
  const parsed = parseInput(z.object({ password: passwordSchema }), input);
  if (!parsed.ok) return parsed;

  const authentication = await deps.auth.currentAuthentication();
  if (!authentication.ok) return authentication;
  if (!isFreshRecoverySession(authentication.value, deps.clock.now())) {
    return err(
      new DomainError(
        AUTH_ERROR.RECOVERY_REQUIRED,
        "password change needs a recent recovery session",
      ),
    );
  }

  return deps.auth.updatePassword(parsed.value);
}
