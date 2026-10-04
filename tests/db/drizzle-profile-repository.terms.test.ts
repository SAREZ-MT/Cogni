import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleProfileRepository } from "@/modules/identity/infrastructure/drizzle-profile-repository";
import { profiles } from "@/shared/db/schema";
import { createTestDb } from "./helpers/test-db";
import { createTestOwner, deleteTestOwner } from "./helpers/test-owner";

// Same three behaviours as InMemoryProfileRepository.acceptTerms
// (application/testing/in-memory-profile-repository.test.ts), against the
// real table (0008_profiles_terms.sql).
if (process.env.DATABASE_URL) {
  const db = createTestDb();
  const repository = new DrizzleProfileRepository(db);
  const owner = await createTestOwner("profile-terms");

  afterAll(async () => {
    try {
      await deleteTestOwner(owner.id);
    } finally {
      await db.$client.end();
    }
  });

  await db.insert(profiles).values({ id: owner.id });

  describe("DrizzleProfileRepository.acceptTerms", () => {
    const FIRST = new Date("2026-10-04T12:00:00.000Z");
    const SECOND = new Date("2026-11-01T00:00:00.000Z");

    it("starts with no acceptance recorded", async () => {
      expect(await repository.findById(owner.id)).toMatchObject({
        termsAcceptedVersion: null,
        termsAcceptedAt: null,
      });
    });

    it("sets version, timestamp and updatedAt", async () => {
      const accepted = await repository.acceptTerms(
        owner.id,
        "2026-10-04",
        FIRST,
      );

      expect(accepted).toMatchObject({
        termsAcceptedVersion: "2026-10-04",
        termsAcceptedAt: FIRST,
        updatedAt: FIRST,
      });
      expect(await repository.findById(owner.id)).toEqual(accepted);
    });

    it("keeps the latest acceptance when accepting twice", async () => {
      await repository.acceptTerms(owner.id, "2026-10-04", FIRST);
      await repository.acceptTerms(owner.id, "2026-11-01", SECOND);

      expect(await repository.findById(owner.id)).toMatchObject({
        termsAcceptedVersion: "2026-11-01",
        termsAcceptedAt: SECOND,
      });
    });

    it("returns null for an unknown id", async () => {
      expect(
        await repository.acceptTerms(randomUUID(), "2026-10-04", FIRST),
      ).toBeNull();
    });
  });
}
