import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { Profile } from "../domain/profile";
import type { ProfileRepository } from "../domain/profile-repository";
import { hasChosenTimeZone, parseTimeZone } from "../domain/time-zone";
import { ensureProfile } from "./ensure-profile";

export interface UpdateProfileTimeZoneDeps {
  profiles: ProfileRepository;
  clock: Clock;
}

function notFound(): Result<never, DomainError> {
  return err(new DomainError("PROFILE_NOT_FOUND", "profile does not exist"));
}

// "Configuración › Zona horaria": the signed-in user picks the IANA zone
// calendar and dashboard dates are read in. Ownership comes from the
// session (ownerId), never from input. Profile creation is lazy, so ensure
// the row first, as acceptTerms does.
export async function updateProfileTimeZone(
  input: { ownerId: string; timeZone: unknown },
  deps: UpdateProfileTimeZoneDeps,
): Promise<Result<Profile, DomainError>> {
  const parsed = parseTimeZone(input.timeZone);
  if (!parsed.ok) return parsed;

  const ensured = await ensureProfile({ ownerId: input.ownerId }, deps);
  if (!ensured.ok) return ensured;

  const saved = await deps.profiles.updateTimeZone(
    input.ownerId,
    parsed.value,
    deps.clock.now(),
  );
  return saved ? ok(saved) : notFound();
}

export interface AdoptedTimeZone {
  // False when the profile already had a chosen zone (kept untouched).
  adopted: boolean;
  timeZone: string;
}

// First use: the shell reports the browser's zone and it is saved only
// while the profile still holds the unset default, so nobody silently stays
// on UTC and a zone the user picked (possibly in another tab) always wins.
export async function adoptBrowserTimeZone(
  input: { ownerId: string; timeZone: unknown },
  deps: UpdateProfileTimeZoneDeps,
): Promise<Result<AdoptedTimeZone, DomainError>> {
  const parsed = parseTimeZone(input.timeZone);
  if (!parsed.ok) return parsed;

  const ensured = await ensureProfile({ ownerId: input.ownerId }, deps);
  if (!ensured.ok) return ensured;
  if (hasChosenTimeZone(ensured.value)) {
    return ok({ adopted: false, timeZone: ensured.value.timezone });
  }

  const saved = await deps.profiles.updateTimeZone(
    input.ownerId,
    parsed.value,
    deps.clock.now(),
    { onlyIfUnset: true },
  );
  if (saved) return ok({ adopted: true, timeZone: saved.timezone });

  // The conditional write lost a race with an explicit choice: report the
  // zone that is stored now.
  const current = await deps.profiles.findById(input.ownerId);
  return current
    ? ok({ adopted: false, timeZone: current.timezone })
    : notFound();
}
