import type { Profile } from "./profile";

// Port implemented by infrastructure (Drizzle) and by the in-memory test
// double. Upsert must be idempotent on id.
export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  upsert(profile: Profile): Promise<void>;
  // Records the accepted terms version on an existing profile. Null when
  // the profile does not exist (callers ensure it first). Last write wins.
  acceptTerms(id: string, version: string, at: Date): Promise<Profile | null>;
  // Sets the profile time zone (an already validated IANA name). With
  // `onlyIfUnset` the write happens only while the column still holds the
  // default (DEFAULT_TIMEZONE), atomically, so a browser detection never
  // overwrites a zone the user chose meanwhile. Null when the profile does
  // not exist or the condition skipped the write.
  updateTimeZone(
    id: string,
    timeZone: string,
    at: Date,
    options?: { onlyIfUnset?: boolean },
  ): Promise<Profile | null>;
}
