import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { AUTH_ERROR } from "../domain/auth-errors";
import type { Profile } from "../domain/profile";
import type { ProfileRepository } from "../domain/profile-repository";

// Ownership is enforced here, not in the database: the server connection
// bypasses RLS (documento-maestro 6.2), so application code must filter.
export async function getProfile(
  input: { ownerId: string; profileId: string },
  deps: { profiles: ProfileRepository },
): Promise<Result<Profile, DomainError>> {
  if (input.profileId !== input.ownerId) {
    return err(
      new DomainError(AUTH_ERROR.FORBIDDEN, "profile belongs to another user"),
    );
  }
  const profile = await deps.profiles.findById(input.profileId);
  if (!profile) {
    return err(new DomainError("PROFILE_NOT_FOUND", "profile does not exist"));
  }
  return ok(profile);
}
