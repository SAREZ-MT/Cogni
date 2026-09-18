import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { AuthGateway } from "../domain/auth-gateway";
import { credentialsSchema, parseInput } from "./credentials-schema";

export async function signIn(
  input: unknown,
  deps: { auth: AuthGateway },
): Promise<Result<void, DomainError>> {
  const parsed = parseInput(credentialsSchema, input);
  if (!parsed.ok) return parsed;

  return deps.auth.signInWithPassword(parsed.value);
}
