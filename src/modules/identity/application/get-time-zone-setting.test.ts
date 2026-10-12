import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { DEFAULT_TIMEZONE } from "../domain/profile";
import { ensureProfile } from "./ensure-profile";
import { getTimeZoneSetting } from "./get-time-zone-setting";
import { InMemoryProfileRepository } from "./testing/in-memory-profile-repository";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const clock = createFixedClock(new Date("2026-10-12T10:00:00.000Z"));

describe("getTimeZoneSetting", () => {
  it("reports the default zone as not chosen", async () => {
    const profiles = new InMemoryProfileRepository();
    await ensureProfile({ ownerId: OWNER_ID }, { profiles, clock });

    expect(
      await getTimeZoneSetting({ ownerId: OWNER_ID }, { profiles }),
    ).toEqual({
      timeZone: DEFAULT_TIMEZONE,
      chosen: false,
    });
  });

  it("reports a stored zone as chosen", async () => {
    const profiles = new InMemoryProfileRepository();
    await ensureProfile({ ownerId: OWNER_ID }, { profiles, clock });
    await profiles.updateTimeZone(OWNER_ID, "America/Bogota", clock.now());

    expect(
      await getTimeZoneSetting({ ownerId: OWNER_ID }, { profiles }),
    ).toEqual({
      timeZone: "America/Bogota",
      chosen: true,
    });
  });

  it("falls back to the unchosen default when the profile does not exist yet", async () => {
    const profiles = new InMemoryProfileRepository();

    expect(
      await getTimeZoneSetting({ ownerId: OWNER_ID }, { profiles }),
    ).toEqual({
      timeZone: DEFAULT_TIMEZONE,
      chosen: false,
    });
  });
});
