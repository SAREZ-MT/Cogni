import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { AuthGateway, SignUpResult } from "../domain/auth-gateway";
import { signUpConsentMetadata } from "../domain/terms-consent";
import { credentialsSchema, parseInput } from "./credentials-schema";

export const AUTH_CALLBACK_PATH = "/auth/callback";

// Submitting the form is the acceptance (sign-in-wrap notice next to the
// button), so the consent proof is attached here from the server clock;
// credentialsSchema drops any consent field the client sends.
export async function signUp(
  input: unknown,
  deps: { auth: AuthGateway; siteUrl: string; clock: Clock },
): Promise<Result<SignUpResult, DomainError>> {
  const parsed = parseInput(credentialsSchema, input);
  if (!parsed.ok) return parsed;

  return deps.auth.signUp({
    email: parsed.value.email,
    password: parsed.value.password,
    emailRedirectTo: `${deps.siteUrl}${AUTH_CALLBACK_PATH}`,
    userMetadata: signUpConsentMetadata(deps.clock.now()),
  });
}
