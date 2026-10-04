import type { Clock } from "@/shared/kernel/clock";
import type { Profile } from "./profile";

// Date of the current terms text. Bumping it asks every account to accept
// again on its next request (the gate compares against this constant).
export const TERMS_VERSION = "2026-10-04";

export function hasAcceptedCurrentTerms(profile: Profile): boolean {
  return profile.termsAcceptedVersion === TERMS_VERSION;
}

export function acceptTerms(
  profile: Profile,
  version: string,
  clock: Clock,
): Profile {
  const now = clock.now();
  return {
    ...profile,
    termsAcceptedVersion: version,
    termsAcceptedAt: now,
    updatedAt: now,
  };
}
