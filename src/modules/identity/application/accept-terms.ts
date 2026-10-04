import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { AUTH_ERROR } from "../domain/auth-errors";
import type { Profile } from "../domain/profile";
import type { ProfileRepository } from "../domain/profile-repository";
import { acceptTerms as stampAcceptance, TERMS_VERSION } from "../domain/terms";
import { ensureProfile } from "./ensure-profile";

export interface AcceptTermsDeps {
  profiles: ProfileRepository;
  clock: Clock;
}

// Records that the signed-in user accepted the current terms version.
// Profile creation is lazy (ensureProfile runs in the app layout), so a
// user can reach this before a row exists: ensure it first instead of
// failing. Idempotent: accepting again just refreshes the timestamp.
export async function acceptTerms(
  input: { accepted: boolean },
  deps: AcceptTermsDeps,
  ownerId: string,
): Promise<Result<Profile, DomainError>> {
  if (input.accepted !== true) {
    return err(
      new DomainError(
        AUTH_ERROR.TERMS_NOT_ACCEPTED,
        "terms must be accepted to continue",
      ),
    );
  }

  const ensured = await ensureProfile({ ownerId }, deps);
  if (!ensured.ok) return ensured;

  const stamped = stampAcceptance(ensured.value, TERMS_VERSION, deps.clock);
  const saved = await deps.profiles.acceptTerms(
    ownerId,
    TERMS_VERSION,
    stamped.updatedAt,
  );
  if (!saved) {
    return err(new DomainError("PROFILE_NOT_FOUND", "profile does not exist"));
  }
  return ok(saved);
}
