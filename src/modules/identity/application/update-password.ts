import { z } from "zod";
import type { DomainError } from "@/shared/kernel/domain-error";
import type { Result } from "@/shared/kernel/result";
import type { AuthGateway } from "../domain/auth-gateway";
import { parseInput, passwordSchema } from "./credentials-schema";

export async function updatePassword(
  input: unknown,
  deps: { auth: AuthGateway },
): Promise<Result<void, DomainError>> {
  const parsed = parseInput(z.object({ password: passwordSchema }), input);
  if (!parsed.ok) return parsed;

  return deps.auth.updatePassword(parsed.value);
}
