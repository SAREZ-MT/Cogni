import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createProfile, DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "./profile";

const NOW = new Date("2026-09-17T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

describe("createProfile", () => {
  it("builds a profile with Spanish locale and timestamps from the clock", () => {
    const result = createProfile({ id: OWNER_ID }, createFixedClock(NOW));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      id: OWNER_ID,
      displayName: null,
      locale: DEFAULT_LOCALE,
      timezone: DEFAULT_TIMEZONE,
      onboardingCompletedAt: null,
      termsAcceptedVersion: null,
      termsAcceptedAt: null,
      termsAcceptedMethod: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(DEFAULT_LOCALE).toBe("es");
  });

  it("keeps an explicit display name and timezone", () => {
    const result = createProfile(
      { id: OWNER_ID, displayName: "Ana", timezone: "America/Bogota" },
      createFixedClock(NOW),
    );

    expect(result.ok && result.value.displayName).toBe("Ana");
    expect(result.ok && result.value.timezone).toBe("America/Bogota");
  });

  it("rejects an id that is not a UUID", () => {
    const result = createProfile({ id: "not-a-uuid" }, createFixedClock(NOW));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("INVALID_PROFILE_ID");
  });

  it("rejects a blank display name instead of storing whitespace", () => {
    const result = createProfile(
      { id: OWNER_ID, displayName: "   " },
      createFixedClock(NOW),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("INVALID_DISPLAY_NAME");
  });
});
