import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createProfile, type Profile } from "./profile";
import {
  acceptTerms,
  hasAcceptedCurrentTerms,
  TERMS_PATH,
  TERMS_VERSION,
  termsRedirectFor,
} from "./terms";

const NOW = new Date("2026-10-04T10:00:00.000Z");
const LATER = new Date("2026-10-05T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

function freshProfile(): Profile {
  const created = createProfile({ id: OWNER_ID }, createFixedClock(NOW));
  if (!created.ok) throw created.error;
  return created.value;
}

describe("TERMS_VERSION", () => {
  it("is the date of the current terms text", () => {
    expect(TERMS_VERSION).toBe("2026-10-28");
  });
});

describe("hasAcceptedCurrentTerms", () => {
  it("is false for a profile that never accepted", () => {
    expect(hasAcceptedCurrentTerms(freshProfile())).toBe(false);
  });

  it("is false when the accepted version is an older one", () => {
    const profile = { ...freshProfile(), termsAcceptedVersion: "2026-01-01" };
    expect(hasAcceptedCurrentTerms(profile)).toBe(false);
  });

  it("is true only for the current version", () => {
    const profile = { ...freshProfile(), termsAcceptedVersion: TERMS_VERSION };
    expect(hasAcceptedCurrentTerms(profile)).toBe(true);
  });
});

describe("acceptTerms", () => {
  it("records version and timestamp and bumps updatedAt", () => {
    const accepted = acceptTerms(
      freshProfile(),
      TERMS_VERSION,
      createFixedClock(LATER),
    );

    expect(accepted.termsAcceptedVersion).toBe(TERMS_VERSION);
    expect(accepted.termsAcceptedAt).toEqual(LATER);
    expect(accepted.updatedAt).toEqual(LATER);
    expect(accepted.createdAt).toEqual(NOW);
  });

  it("does not mutate the input profile", () => {
    const profile = freshProfile();
    acceptTerms(profile, TERMS_VERSION, createFixedClock(LATER));
    expect(profile.termsAcceptedVersion).toBeNull();
  });
});

describe("termsRedirectFor", () => {
  const accepted = { ...freshProfile(), termsAcceptedVersion: TERMS_VERSION };

  it("sends a pending profile to the terms page carrying the current path", () => {
    expect(termsRedirectFor(freshProfile(), "/notebooks/abc?tab=1")).toBe(
      `${TERMS_PATH}?next=%2Fnotebooks%2Fabc%3Ftab%3D1`,
    );
  });

  it("falls back to the root when the current path is unknown or not a local path", () => {
    const expected = `${TERMS_PATH}?next=%2F`;
    expect(termsRedirectFor(freshProfile(), null)).toBe(expected);
    expect(termsRedirectFor(freshProfile(), "")).toBe(expected);
    expect(termsRedirectFor(freshProfile(), "https://evil.test")).toBe(
      expected,
    );
  });

  it("does not redirect a profile that accepted the current version", () => {
    expect(termsRedirectFor(accepted, "/")).toBeNull();
  });

  it("fails open when the profile could not be loaded", () => {
    expect(termsRedirectFor(null, "/")).toBeNull();
  });
});
