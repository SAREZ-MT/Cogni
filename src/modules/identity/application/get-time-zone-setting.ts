import { DEFAULT_TIMEZONE } from "../domain/profile";
import type { ProfileRepository } from "../domain/profile-repository";
import { hasChosenTimeZone } from "../domain/time-zone";

export interface TimeZoneSetting {
  // IANA zone dates are read in; the unset default ("UTC") until chosen.
  timeZone: string;
  // False until the user or the browser detection set a zone.
  chosen: boolean;
}

// The shell's read of the profile time zone (calendar dates, settings).
// A missing row behaves like a new profile: lazy creation runs in the
// layout, so this never fails a page for it.
export async function getTimeZoneSetting(
  input: { ownerId: string },
  deps: { profiles: ProfileRepository },
): Promise<TimeZoneSetting> {
  const profile = await deps.profiles.findById(input.ownerId);
  if (!profile) return { timeZone: DEFAULT_TIMEZONE, chosen: false };
  return { timeZone: profile.timezone, chosen: hasChosenTimeZone(profile) };
}
