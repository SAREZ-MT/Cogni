import { describe, expect, it } from "vitest";
import { InMemoryProfileRepository } from "./in-memory-profile-repository";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

const NOW = new Date("2026-09-22T10:00:00.000Z");

function profile(overrides: { displayName?: string | null; updatedAt?: Date }) {
  return {
    id: OWNER_ID,
    displayName: overrides.displayName ?? null,
    locale: "es",
    timezone: "UTC",
    onboardingCompletedAt: null,
    createdAt: NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  };
}

// specs/identity-auth/spec.md, "Autorización por propiedad en la capa de
// aplicación", Scenario "Upsert no sobrescribe campos existentes": mirrors
// the real repository's `onConflictDoNothing` (insert-or-ignore, not
// insert-or-overwrite).
describe("InMemoryProfileRepository.upsert", () => {
  it("does not overwrite an existing row's fields on a repeated upsert", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({ displayName: "Ana" }));

    await repository.upsert(
      profile({
        displayName: null,
        updatedAt: new Date("2026-09-23T00:00:00.000Z"),
      }),
    );

    expect(await repository.findById(OWNER_ID)).toMatchObject({
      displayName: "Ana",
      updatedAt: NOW,
    });
  });

  it("inserts the row on the first upsert for a new id", async () => {
    const repository = new InMemoryProfileRepository();

    await repository.upsert(profile({ displayName: "Beto" }));

    expect(await repository.findById(OWNER_ID)).toMatchObject({
      displayName: "Beto",
    });
    expect(repository.count()).toBe(1);
  });
});
