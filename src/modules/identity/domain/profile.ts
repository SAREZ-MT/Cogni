import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { isValidId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { TermsAcceptanceMethod } from "./terms-consent";

// Profile mirrors auth.users one to one: its id IS the Supabase user id.
export interface Profile {
  readonly id: string;
  readonly displayName: string | null;
  readonly locale: string;
  readonly timezone: string;
  readonly onboardingCompletedAt: Date | null;
  readonly termsAcceptedVersion: string | null;
  readonly termsAcceptedAt: Date | null;
  // How the acceptance was given; null for acceptances recorded before
  // migration 0015.
  readonly termsAcceptedMethod: TermsAcceptanceMethod | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const DEFAULT_LOCALE = "es";
export const DEFAULT_TIMEZONE = "UTC";

export interface NewProfile {
  id: string;
  displayName?: string | null;
  timezone?: string;
}

export function createProfile(
  input: NewProfile,
  clock: Clock,
): Result<Profile, DomainError> {
  if (!isValidId(input.id)) {
    return err(
      new DomainError("INVALID_PROFILE_ID", "profile id must be a UUID"),
    );
  }
  const displayName = input.displayName ?? null;
  if (displayName !== null && displayName.trim().length === 0) {
    return err(
      new DomainError("INVALID_DISPLAY_NAME", "display name cannot be blank"),
    );
  }
  const now = clock.now();
  return ok({
    id: input.id,
    displayName,
    locale: DEFAULT_LOCALE,
    timezone: input.timezone ?? DEFAULT_TIMEZONE,
    onboardingCompletedAt: null,
    termsAcceptedVersion: null,
    termsAcceptedAt: null,
    termsAcceptedMethod: null,
    createdAt: now,
    updatedAt: now,
  });
}
