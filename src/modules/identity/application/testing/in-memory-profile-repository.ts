import type { Profile } from "../../domain/profile";
import type { ProfileRepository } from "../../domain/profile-repository";

// Test double for the ProfileRepository port. Upsert semantics mirror the
// SQL adapter: same id overwrites, never duplicates.
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly rows = new Map<string, Profile>();

  async findById(id: string): Promise<Profile | null> {
    return this.rows.get(id) ?? null;
  }

  async upsert(profile: Profile): Promise<void> {
    this.rows.set(profile.id, profile);
  }

  count(): number {
    return this.rows.size;
  }
}
