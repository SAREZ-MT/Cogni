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
    termsAcceptedVersion: null,
    termsAcceptedAt: null,
    termsAcceptedMethod: null,
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

describe("InMemoryProfileRepository.acceptTerms", () => {
  const AT = new Date("2026-10-04T12:00:00.000Z");

  it("sets version, timestamp and updatedAt on the existing row", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({ displayName: "Ana" }));

    const accepted = await repository.acceptTerms(OWNER_ID, "2026-10-04", AT);

    expect(accepted).toMatchObject({
      displayName: "Ana",
      termsAcceptedVersion: "2026-10-04",
      termsAcceptedAt: AT,
      updatedAt: AT,
    });
    expect(await repository.findById(OWNER_ID)).toEqual(accepted);
  });

  it("keeps the latest acceptance when accepting twice", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({}));
    const later = new Date("2026-11-01T00:00:00.000Z");

    await repository.acceptTerms(OWNER_ID, "2026-10-04", AT);
    await repository.acceptTerms(OWNER_ID, "2026-11-01", later);

    expect(await repository.findById(OWNER_ID)).toMatchObject({
      termsAcceptedVersion: "2026-11-01",
      termsAcceptedAt: later,
    });
  });

  it("records the acceptance method", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({}));

    await repository.acceptTerms(OWNER_ID, "2026-10-28", AT, {
      method: "google",
    });

    expect(await repository.findById(OWNER_ID)).toMatchObject({
      termsAcceptedMethod: "google",
    });
  });

  it("skips the write with onlyIfUnaccepted once an acceptance exists", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({}));
    await repository.acceptTerms(OWNER_ID, "2026-10-04", AT, {
      method: "gate",
    });

    const skipped = await repository.acceptTerms(
      OWNER_ID,
      "2026-10-28",
      new Date("2026-10-28T00:00:00.000Z"),
      { method: "email", onlyIfUnaccepted: true },
    );

    expect(skipped).toBeNull();
    expect(await repository.findById(OWNER_ID)).toMatchObject({
      termsAcceptedVersion: "2026-10-04",
      termsAcceptedMethod: "gate",
    });
  });

  it("returns null for an unknown id", async () => {
    const repository = new InMemoryProfileRepository();
    expect(await repository.acceptTerms(OWNER_ID, "2026-10-04", AT)).toBeNull();
    expect(repository.count()).toBe(0);
  });
});

// Same behaviours as tests/db/drizzle-profile-repository.time-zone.test.ts
// against the real table.
describe("InMemoryProfileRepository.updateTimeZone", () => {
  const AT = new Date("2026-10-12T12:00:00.000Z");

  it("sets the zone and updatedAt on the existing row", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({ displayName: "Ana" }));

    const updated = await repository.updateTimeZone(
      OWNER_ID,
      "America/Bogota",
      AT,
    );

    expect(updated).toMatchObject({
      displayName: "Ana",
      timezone: "America/Bogota",
      updatedAt: AT,
    });
    expect(await repository.findById(OWNER_ID)).toEqual(updated);
  });

  it("overwrites a previous choice by default", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({}));
    await repository.updateTimeZone(OWNER_ID, "America/Bogota", AT);

    await repository.updateTimeZone(OWNER_ID, "Europe/Madrid", AT);

    expect((await repository.findById(OWNER_ID))?.timezone).toBe(
      "Europe/Madrid",
    );
  });

  it("with onlyIfUnset writes over the default zone", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({}));

    const updated = await repository.updateTimeZone(
      OWNER_ID,
      "America/Bogota",
      AT,
      { onlyIfUnset: true },
    );

    expect(updated?.timezone).toBe("America/Bogota");
  });

  it("with onlyIfUnset leaves a chosen zone untouched and returns null", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.upsert(profile({}));
    await repository.updateTimeZone(OWNER_ID, "Etc/UTC", AT);

    const updated = await repository.updateTimeZone(
      OWNER_ID,
      "America/Bogota",
      new Date("2026-10-13T00:00:00.000Z"),
      { onlyIfUnset: true },
    );

    expect(updated).toBeNull();
    expect(await repository.findById(OWNER_ID)).toMatchObject({
      timezone: "Etc/UTC",
      updatedAt: AT,
    });
  });

  it("returns null for an unknown id", async () => {
    const repository = new InMemoryProfileRepository();

    expect(
      await repository.updateTimeZone(OWNER_ID, "America/Bogota", AT),
    ).toBeNull();
    expect(repository.count()).toBe(0);
  });
});
