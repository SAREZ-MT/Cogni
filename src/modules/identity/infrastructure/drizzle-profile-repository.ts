import { and, eq } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { type ProfileRow, profiles } from "@/shared/db/schema";
import { DEFAULT_TIMEZONE, type Profile } from "../domain/profile";
import type { ProfileRepository } from "../domain/profile-repository";

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.displayName,
    locale: row.locale,
    timezone: row.timezone,
    onboardingCompletedAt: row.onboardingCompletedAt,
    termsAcceptedVersion: row.termsAcceptedVersion,
    termsAcceptedAt: row.termsAcceptedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Profile | null> {
    const row = await this.db.query.profiles.findFirst({
      where: eq(profiles.id, id),
    });
    return row ? toProfile(row) : null;
  }

  /**
   * Insert-or-ignore (`onConflictDoNothing`), not upsert-and-overwrite.
   *
   * Two deliberate reasons, both required by
   * specs/identity-auth/spec.md ("Autorización por propiedad en la capa
   * de aplicación", "Upsert no sobrescribe campos existentes"):
   * - it keeps `EnsureProfile` idempotent under concurrent first requests
   *   (two tabs finishing verification at the same time);
   * - it never overwrites a `display_name`/`locale`/`timezone` the user
   *   already personalized with the defaults `createProfile` fills in on
   *   every repeated call. `onConflictDoUpdate` would silently discard
   *   that personalization on every subsequent sign-in.
   */
  async upsert(profile: Profile): Promise<void> {
    await this.db
      .insert(profiles)
      .values({
        id: profile.id,
        displayName: profile.displayName,
        locale: profile.locale,
        timezone: profile.timezone,
        onboardingCompletedAt: profile.onboardingCompletedAt,
        termsAcceptedVersion: profile.termsAcceptedVersion,
        termsAcceptedAt: profile.termsAcceptedAt,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      })
      .onConflictDoNothing({ target: profiles.id });
  }

  async acceptTerms(
    id: string,
    version: string,
    at: Date,
  ): Promise<Profile | null> {
    const [row] = await this.db
      .update(profiles)
      .set({
        termsAcceptedVersion: version,
        termsAcceptedAt: at,
        updatedAt: at,
      })
      .where(eq(profiles.id, id))
      .returning();
    return row ? toProfile(row) : null;
  }

  // `onlyIfUnset` is a conditional UPDATE (WHERE timezone = default), so a
  // concurrent explicit choice always wins over the browser detection.
  async updateTimeZone(
    id: string,
    timeZone: string,
    at: Date,
    options: { onlyIfUnset?: boolean } = {},
  ): Promise<Profile | null> {
    const byId = eq(profiles.id, id);
    const [row] = await this.db
      .update(profiles)
      .set({ timezone: timeZone, updatedAt: at })
      .where(
        options.onlyIfUnset
          ? and(byId, eq(profiles.timezone, DEFAULT_TIMEZONE))
          : byId,
      )
      .returning();
    return row ? toProfile(row) : null;
  }
}
