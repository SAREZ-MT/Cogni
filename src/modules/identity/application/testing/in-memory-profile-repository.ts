import { DEFAULT_TIMEZONE, type Profile } from "../../domain/profile";
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

  async acceptTerms(
    id: string,
    version: string,
    at: Date,
  ): Promise<Profile | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: Profile = {
      ...existing,
      termsAcceptedVersion: version,
      termsAcceptedAt: at,
      updatedAt: at,
    };
    this.rows.set(id, updated);
    return updated;
  }

  async updateTimeZone(
    id: string,
    timeZone: string,
    at: Date,
    options: { onlyIfUnset?: boolean } = {},
  ): Promise<Profile | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    if (options.onlyIfUnset && existing.timezone !== DEFAULT_TIMEZONE) {
      return null;
    }
    const updated: Profile = { ...existing, timezone: timeZone, updatedAt: at };
    this.rows.set(id, updated);
    return updated;
  }

  count(): number {
    return this.rows.size;
  }
}
