import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { AUTH_ERROR } from "../domain/auth-errors";
import { ensureProfile } from "./ensure-profile";
import { getProfile } from "./get-profile";
import { InMemoryProfileRepository } from "./testing/in-memory-profile-repository";

const NOW = new Date("2026-09-17T10:00:00.000Z");
const ANA = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const LUIS = "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f";

describe("getProfile", () => {
  it("returns the owner's own profile", async () => {
    const profiles = new InMemoryProfileRepository();
    await ensureProfile(
      { ownerId: ANA },
      { profiles, clock: createFixedClock(NOW) },
    );

    const result = await getProfile(
      { ownerId: ANA, profileId: ANA },
      { profiles },
    );

    expect(result.ok && result.value.id).toBe(ANA);
  });

  it("refuses another user's profile with a domain error and no data", async () => {
    const profiles = new InMemoryProfileRepository();
    await ensureProfile(
      { ownerId: LUIS },
      { profiles, clock: createFixedClock(NOW) },
    );

    const result = await getProfile(
      { ownerId: ANA, profileId: LUIS },
      { profiles },
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe(AUTH_ERROR.FORBIDDEN);
  });
});
