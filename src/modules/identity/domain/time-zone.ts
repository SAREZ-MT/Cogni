import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { DEFAULT_TIMEZONE, type Profile } from "./profile";

export const PROFILE_ERROR = {
  INVALID_TIME_ZONE: "PROFILE_INVALID_TIME_ZONE",
} as const;

// `profiles.timezone` is NOT NULL DEFAULT 'UTC' (0000_profiles.sql), so the
// literal "UTC" doubles as the "never chosen" marker without a migration:
// an explicit UTC choice is always stored as the equivalent IANA name
// Etc/UTC. Shell code formats dates with either one unchanged.
export const EXPLICIT_UTC = "Etc/UTC";

// IANA names only: letters, digits, "_", "+", "-" in "/"-separated
// segments (Etc/GMT+5 included). Rejects raw offsets such as "+05:00",
// which Intl accepts but which would not follow daylight saving changes.
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;
const MAX_LENGTH = 64;

function invalid(): Result<string, DomainError> {
  return err(
    new DomainError(
      PROFILE_ERROR.INVALID_TIME_ZONE,
      "time zone must be an IANA name",
    ),
  );
}

// Validates through the runtime's own Intl (ICU) instead of membership in
// Intl.supportedValuesOf("timeZone"): that list holds canonical names only,
// and Node 22's ICU lists Asia/Calcutta while browsers report the newer
// alias Asia/Kolkata, so a membership check would reject valid detections.
// The constructor accepts every alias, and resolvedOptions() returns the
// engine's canonical spelling — the one the settings select lists.
export function parseTimeZone(raw: unknown): Result<string, DomainError> {
  if (typeof raw !== "string") return invalid();
  const name = raw.trim();
  if (name.length === 0 || name.length > MAX_LENGTH) return invalid();
  if (!IANA_NAME.test(name)) return invalid();
  let canonical: string;
  try {
    canonical = new Intl.DateTimeFormat("en", {
      timeZone: name,
    }).resolvedOptions().timeZone;
  } catch {
    return invalid();
  }
  if (canonical === "UTC") return ok(EXPLICIT_UTC);
  if (!IANA_NAME.test(canonical)) return invalid();
  return ok(canonical);
}

// False only for the column default: the user (or the browser detection)
// never set a zone, so the shell may still adopt the browser's one.
export function hasChosenTimeZone(profile: Pick<Profile, "timezone">): boolean {
  return profile.timezone !== DEFAULT_TIMEZONE;
}
