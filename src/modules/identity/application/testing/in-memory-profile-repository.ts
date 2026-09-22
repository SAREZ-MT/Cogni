import type { Profile } from "../../domain/profile";
import type { ProfileRepository } from "../../domain/profile-repository";

// Test double for the ProfileRepository port. Upsert semantics mirror the
// SQL adapter's `onConflictDoNothing`: insert-or-ignore, never overwrite an
// existing row (specs/identity-auth/spec.md, "Upsert no sobrescribe
// campos existentes").
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly rows = new Map<string, Profile>();

  async findById(id: string): Promise<Profile | null> {
    return this.rows.get(id) ?? null;
  }

  async upsert(profile: Profile): Promise<void> {
    if (this.rows.has(profile.id)) return;
    this.rows.set(profile.id, profile);
  }

  count(): number {
    return this.rows.size;
  }
}
