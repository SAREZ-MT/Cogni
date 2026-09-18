import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { ensureProfile } from "./ensure-profile";
import { InMemoryProfileRepository } from "./testing/in-memory-profile-repository";

const NOW = new Date("2026-09-17T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

describe("ensureProfile", () => {
  it("creates the profile with locale es on the first authenticated request", async () => {
    const profiles = new InMemoryProfileRepository();

    const result = await ensureProfile(
      { ownerId: OWNER_ID },
      { profiles, clock: createFixedClock(NOW) },
    );

    expect(result.ok).toBe(true);
    expect(await profiles.findById(OWNER_ID)).toMatchObject({
      id: OWNER_ID,
      locale: "es",
    });
  });

  it("is idempotent: repeated sign-ins keep exactly one row and its data", async () => {
    const profiles = new InMemoryProfileRepository();
    const deps = { profiles, clock: createFixedClock(NOW) };
    const first = await ensureProfile({ ownerId: OWNER_ID }, deps);

    const second = await ensureProfile(
      { ownerId: OWNER_ID },
      {
        profiles,
        clock: createFixedClock(new Date("2026-09-18T10:00:00.000Z")),
      },
    );

    expect(profiles.count()).toBe(1);
    expect(second.ok && second.value.createdAt).toEqual(
      first.ok && first.value.createdAt,
    );
  });

  it("returns a domain error for an invalid owner id without touching the repository", async () => {
    const profiles = new InMemoryProfileRepository();

    const result = await ensureProfile(
      { ownerId: "nope" },
      { profiles, clock: createFixedClock(NOW) },
    );

    expect(result.ok).toBe(false);
    expect(profiles.count()).toBe(0);
  });
});
