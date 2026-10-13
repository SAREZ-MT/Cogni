import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleProfileRepository } from "@/modules/identity/infrastructure/drizzle-profile-repository";
import { profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Same behaviours as InMemoryProfileRepository.updateTimeZone
// (application/testing/in-memory-profile-repository.test.ts), against the
// real table: `timezone` is NOT NULL DEFAULT 'UTC' (0000_profiles.sql).
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const repository = new DrizzleProfileRepository(db);
  const owner = await createTestOwner("profile-time-zone");

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values({ id: owner.id });

  describe("DrizzleProfileRepository.updateTimeZone", () => {
    const AT = new Date("2026-10-12T12:00:00.000Z");
    const LATER = new Date("2026-10-13T00:00:00.000Z");

    beforeEach(async () => {
      await db
        .update(profiles)
        .set({ timezone: "UTC" })
        .where(eq(profiles.id, owner.id));
    });

    it("starts on the column default", async () => {
      expect((await repository.findById(owner.id))?.timezone).toBe("UTC");
    });

    it("sets the zone and updatedAt", async () => {
      const updated = await repository.updateTimeZone(
        owner.id,
        "America/Bogota",
        AT,
      );

      expect(updated).toMatchObject({
        timezone: "America/Bogota",
        updatedAt: AT,
      });
      expect(await repository.findById(owner.id)).toEqual(updated);
    });

    it("with onlyIfUnset writes over the default zone", async () => {
      const updated = await repository.updateTimeZone(
        owner.id,
        "Europe/Madrid",
        AT,
        { onlyIfUnset: true },
      );

      expect(updated?.timezone).toBe("Europe/Madrid");
    });

    it("with onlyIfUnset leaves a chosen zone untouched and returns null", async () => {
      await repository.updateTimeZone(owner.id, "Etc/UTC", AT);

      const skipped = await repository.updateTimeZone(
        owner.id,
        "America/Bogota",
        LATER,
        { onlyIfUnset: true },
      );

      expect(skipped).toBeNull();
      expect(await repository.findById(owner.id)).toMatchObject({
        timezone: "Etc/UTC",
        updatedAt: AT,
      });
    });

    it("returns null for an unknown id", async () => {
      expect(
        await repository.updateTimeZone(randomUUID(), "America/Bogota", AT),
      ).toBeNull();
    });
  });
}
