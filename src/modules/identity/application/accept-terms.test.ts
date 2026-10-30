import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { AUTH_ERROR } from "../domain/auth-errors";
import { TERMS_VERSION } from "../domain/terms";
import { acceptTerms } from "./accept-terms";
import { ensureProfile } from "./ensure-profile";
import { getProfile } from "./get-profile";
import { InMemoryProfileRepository } from "./testing/in-memory-profile-repository";

const NOW = new Date("2026-10-04T10:00:00.000Z");
const LATER = new Date("2026-10-05T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

describe("acceptTerms use case", () => {
  it("records the current version and the clock instant on an existing profile", async () => {
    const profiles = new InMemoryProfileRepository();
    await ensureProfile(
      { ownerId: OWNER_ID },
      { profiles, clock: createFixedClock(NOW) },
    );

    const result = await acceptTerms(
      { accepted: true },
      { profiles, clock: createFixedClock(LATER) },
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      termsAcceptedVersion: TERMS_VERSION,
      termsAcceptedAt: LATER,
      termsAcceptedMethod: "gate",
    });
    expect(await profiles.findById(OWNER_ID)).toEqual(result.value);
  });

  it("refuses when the box was not ticked and stores nothing", async () => {
    const profiles = new InMemoryProfileRepository();
    await ensureProfile(
      { ownerId: OWNER_ID },
      { profiles, clock: createFixedClock(NOW) },
    );

    const result = await acceptTerms(
      { accepted: false },
      { profiles, clock: createFixedClock(LATER) },
      OWNER_ID,
    );

    expect(!result.ok && result.error.code).toBe(AUTH_ERROR.TERMS_NOT_ACCEPTED);
    expect(
      (await profiles.findById(OWNER_ID))?.termsAcceptedVersion,
    ).toBeNull();
  });

  it("creates the profile first when the lazy ensure has not run yet", async () => {
    const profiles = new InMemoryProfileRepository();

    const result = await acceptTerms(
      { accepted: true },
      { profiles, clock: createFixedClock(NOW) },
      OWNER_ID,
    );

    expect(result.ok).toBe(true);
    expect(profiles.count()).toBe(1);
    expect((await profiles.findById(OWNER_ID))?.termsAcceptedVersion).toBe(
      TERMS_VERSION,
    );
  });

  it("is idempotent: accepting again keeps one row and the latest timestamp", async () => {
    const profiles = new InMemoryProfileRepository();
    await acceptTerms(
      { accepted: true },
      { profiles, clock: createFixedClock(NOW) },
      OWNER_ID,
    );

    const again = await acceptTerms(
      { accepted: true },
      { profiles, clock: createFixedClock(LATER) },
      OWNER_ID,
    );

    expect(profiles.count()).toBe(1);
    expect(again.ok && again.value.termsAcceptedAt).toEqual(LATER);
  });

  it("is visible through getProfile", async () => {
    const profiles = new InMemoryProfileRepository();
    await acceptTerms(
      { accepted: true },
      { profiles, clock: createFixedClock(NOW) },
      OWNER_ID,
    );

    const read = await getProfile(
      { ownerId: OWNER_ID, profileId: OWNER_ID },
      { profiles },
    );

    expect(read.ok && read.value.termsAcceptedVersion).toBe(TERMS_VERSION);
  });
});
