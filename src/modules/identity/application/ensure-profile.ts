import type { Clock } from "@/shared/kernel/clock";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import { createProfile, type Profile } from "../domain/profile";
import type { ProfileRepository } from "../domain/profile-repository";

export interface EnsureProfileDeps {
  profiles: ProfileRepository;
  clock: Clock;
}

// Runs on the first authenticated request (app layout). Idempotent: an
// existing row is returned untouched, so repeated sign-ins never duplicate.
export async function ensureProfile(
  input: { ownerId: string },
  deps: EnsureProfileDeps,
): Promise<Result<Profile, DomainError>> {
  const existing = await deps.profiles.findById(input.ownerId);
  if (existing) return ok(existing);

  const created = createProfile({ id: input.ownerId }, deps.clock);
  if (!created.ok) return created;

  await deps.profiles.upsert(created.value);
  return ok(created.value);
}
