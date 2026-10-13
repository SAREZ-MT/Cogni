import { hasChosenTimeZone, type Profile } from "@/modules/identity";
import { TimeZoneAutoDetect } from "@/modules/identity/ui";

// Phase 7 T2a: mounts the first-use browser time-zone detection only while
// the profile still holds the unset default. A null profile (transient read
// failure) skips it; the next render retries.
export function TimeZoneDetection({
  profile,
}: {
  profile: Pick<Profile, "timezone"> | null;
}) {
  if (!profile || hasChosenTimeZone(profile)) return null;
  return <TimeZoneAutoDetect />;
}
