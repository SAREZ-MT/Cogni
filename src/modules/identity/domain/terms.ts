import type { Clock } from "@/shared/kernel/clock";
import type { Profile } from "./profile";

// Date of the current terms text. Bumping it asks every account to accept
// again on its next request (the gate compares against this constant).
export const TERMS_VERSION = "2026-10-04";

export const TERMS_PATH = "/terminos";

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

// Where the (app) layout must send the visitor, or null to let them in.
// A null profile means it could not be loaded (transient failure, already
// reported to Sentry): fail open and re-check on the next render instead
// of locking everyone out during an outage.
export function termsRedirectFor(
  profile: Profile | null,
  currentPath: string | null,
): string | null {
  if (!profile || hasAcceptedCurrentTerms(profile)) return null;
  const next =
    currentPath?.startsWith("/") && !currentPath.startsWith("//")
      ? currentPath
      : "/";
  return `${TERMS_PATH}?next=${encodeURIComponent(next)}`;
}
