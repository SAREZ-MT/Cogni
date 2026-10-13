import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { DEFAULT_TIMEZONE } from "../domain/profile";
import { EXPLICIT_UTC, PROFILE_ERROR } from "../domain/time-zone";
import { ensureProfile } from "./ensure-profile";
import { InMemoryProfileRepository } from "./testing/in-memory-profile-repository";
import {
  adoptBrowserTimeZone,
  updateProfileTimeZone,
} from "./update-profile-time-zone";

const NOW = new Date("2026-10-12T10:00:00.000Z");
const LATER = new Date("2026-10-12T11:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

async function setup() {
  const profiles = new InMemoryProfileRepository();
  await ensureProfile(
    { ownerId: OWNER_ID },
    { profiles, clock: createFixedClock(NOW) },
  );
  return { profiles, clock: createFixedClock(LATER) };
}

describe("updateProfileTimeZone", () => {
  it("stores a valid IANA zone and stamps updatedAt", async () => {
    const deps = await setup();

    const result = await updateProfileTimeZone(
      { ownerId: OWNER_ID, timeZone: "America/Bogota" },
      deps,
    );

    expect(result.ok && result.value).toMatchObject({
      timezone: "America/Bogota",
      updatedAt: LATER,
    });
    expect((await deps.profiles.findById(OWNER_ID))?.timezone).toBe(
      "America/Bogota",
    );
  });

  it("records an explicit UTC choice so it is no longer the unset default", async () => {
    const deps = await setup();

    const result = await updateProfileTimeZone(
      { ownerId: OWNER_ID, timeZone: "UTC" },
      deps,
    );

    expect(result.ok && result.value.timezone).toBe(EXPLICIT_UTC);
  });

  it("replaces a previous choice", async () => {
    const deps = await setup();
    await updateProfileTimeZone(
      { ownerId: OWNER_ID, timeZone: "America/Bogota" },
      deps,
    );

    const result = await updateProfileTimeZone(
      { ownerId: OWNER_ID, timeZone: "Europe/Madrid" },
      deps,
    );

    expect(result.ok && result.value.timezone).toBe("Europe/Madrid");
  });

  it("refuses an invalid zone with a typed error and stores nothing", async () => {
    const deps = await setup();

    const result = await updateProfileTimeZone(
      { ownerId: OWNER_ID, timeZone: "Mars/Olympus_Mons" },
      deps,
    );

    expect(!result.ok && result.error.code).toBe(
      PROFILE_ERROR.INVALID_TIME_ZONE,
    );
    expect((await deps.profiles.findById(OWNER_ID))?.timezone).toBe(
      DEFAULT_TIMEZONE,
    );
  });

  it("creates the profile first when the lazy ensure has not run yet", async () => {
    const profiles = new InMemoryProfileRepository();

    const result = await updateProfileTimeZone(
      { ownerId: OWNER_ID, timeZone: "America/Bogota" },
      { profiles, clock: createFixedClock(NOW) },
    );

    expect(result.ok).toBe(true);
    expect((await profiles.findById(OWNER_ID))?.timezone).toBe(
      "America/Bogota",
    );
  });
});

describe("adoptBrowserTimeZone", () => {
  it("saves the detected zone while the profile is still on the default", async () => {
    const deps = await setup();

    const result = await adoptBrowserTimeZone(
      { ownerId: OWNER_ID, timeZone: "America/Bogota" },
      deps,
    );

    expect(result.ok && result.value).toEqual({
      adopted: true,
      timeZone: "America/Bogota",
    });
    expect((await deps.profiles.findById(OWNER_ID))?.timezone).toBe(
      "America/Bogota",
    );
  });

  it("marks a browser running on UTC as chosen so detection stops", async () => {
    const deps = await setup();

    const result = await adoptBrowserTimeZone(
      { ownerId: OWNER_ID, timeZone: "UTC" },
      deps,
    );

    expect(result.ok && result.value.timeZone).toBe(EXPLICIT_UTC);
  });

  it("never overwrites a zone the user already chose", async () => {
    const deps = await setup();
    await updateProfileTimeZone(
      { ownerId: OWNER_ID, timeZone: "Europe/Madrid" },
      deps,
    );

    const result = await adoptBrowserTimeZone(
      { ownerId: OWNER_ID, timeZone: "America/Bogota" },
      deps,
    );

    expect(result.ok && result.value).toEqual({
      adopted: false,
      timeZone: "Europe/Madrid",
    });
    expect((await deps.profiles.findById(OWNER_ID))?.timezone).toBe(
      "Europe/Madrid",
    );
  });

  it("reports the stored zone when an explicit choice wins the race", async () => {
    const deps = await setup();
    // The user saves Madrid between the read and the conditional write.
    const racing = Object.create(deps.profiles) as InMemoryProfileRepository;
    racing.updateTimeZone = async (id, timeZone, at, options) => {
      await deps.profiles.updateTimeZone(id, "Europe/Madrid", at);
      return deps.profiles.updateTimeZone(id, timeZone, at, options);
    };

    const result = await adoptBrowserTimeZone(
      { ownerId: OWNER_ID, timeZone: "America/Bogota" },
      { profiles: racing, clock: deps.clock },
    );

    expect(result.ok && result.value).toEqual({
      adopted: false,
      timeZone: "Europe/Madrid",
    });
  });

  it("refuses an invalid detection with a typed error", async () => {
    const deps = await setup();

    const result = await adoptBrowserTimeZone(
      { ownerId: OWNER_ID, timeZone: "+05:00" },
      deps,
    );

    expect(!result.ok && result.error.code).toBe(
      PROFILE_ERROR.INVALID_TIME_ZONE,
    );
    expect((await deps.profiles.findById(OWNER_ID))?.timezone).toBe(
      DEFAULT_TIMEZONE,
    );
  });
});
