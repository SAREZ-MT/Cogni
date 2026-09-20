import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { AuthGateway, SignUpResult } from "../domain/auth-gateway";
import { credentialsSchema, parseInput } from "./credentials-schema";

export const AUTH_CALLBACK_PATH = "/auth/callback";

export async function signUp(
  input: unknown,
  deps: { auth: AuthGateway; siteUrl: string },
): Promise<Result<SignUpResult, DomainError>> {
  const parsed = parseInput(credentialsSchema, input);
  if (!parsed.ok) return parsed;

  return deps.auth.signUp({
    ...parsed.value,
    emailRedirectTo: `${deps.siteUrl}${AUTH_CALLBACK_PATH}`,
  });
}
