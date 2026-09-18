import type { Profile } from "./profile";

// Port implemented by infrastructure (Drizzle) and by the in-memory test
// double. Upsert must be idempotent on id.
export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  upsert(profile: Profile): Promise<void>;
}
