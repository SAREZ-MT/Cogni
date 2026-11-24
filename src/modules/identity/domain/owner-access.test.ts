import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { ACCESS_ERROR, ownerAccessError, ownerAccessFor } from "./owner-access";
import { createProfile, type Profile } from "./profile";
import { acceptTerms, TERMS_VERSION } from "./terms";

const OWNER = "2f1b6f0e-6a55-4d0b-9d6c-0f6f1f1c2a01";
const OTHER = "2f1b6f0e-6a55-4d0b-9d6c-0f6f1f1c2a02";
const clock = createFixedClock(new Date("2026-11-23T12:00:00Z"));

function profileOf(id: string): Profile {
  const created = createProfile({ id }, clock);
  if (!created.ok) throw created.error;
  return created.value;
}

function accepted(id: string, version = TERMS_VERSION): Profile {
  return acceptTerms(profileOf(id), version, clock);
}

describe("ownerAccessFor", () => {
  it("grants the owner whose profile accepted the current terms", () => {
    expect(ownerAccessFor({ id: OWNER }, accepted(OWNER))).toEqual({
      status: "granted",
      ownerId: OWNER,
    });
  });

  it("denies a request without a session", () => {
    expect(ownerAccessFor(null, accepted(OWNER))).toEqual({
      status: "denied",
      reason: "session_required",
    });
  });

  it("denies a profile that never accepted the terms", () => {
    expect(ownerAccessFor({ id: OWNER }, profileOf(OWNER))).toEqual({
      status: "denied",
      reason: "terms_required",
    });
  });

  it("denies a profile that accepted an older terms version", () => {
    expect(
      ownerAccessFor({ id: OWNER }, accepted(OWNER, "2026-01-01")),
    ).toEqual({ status: "denied", reason: "terms_required" });
  });

  it("fails closed when the profile could not be loaded", () => {
    expect(ownerAccessFor({ id: OWNER }, null)).toEqual({
      status: "denied",
      reason: "profile_unavailable",
    });
  });

  it("fails closed when the loaded profile belongs to another account", () => {
    expect(ownerAccessFor({ id: OWNER }, accepted(OTHER))).toEqual({
      status: "denied",
      reason: "profile_unavailable",
    });
  });
});

describe("ownerAccessError", () => {
  it("reports a pending terms acceptance with its own code", () => {
    expect(ownerAccessError("terms_required").code).toBe(
      ACCESS_ERROR.TERMS_REQUIRED,
    );
  });

  it("reports an unverifiable profile with its own code", () => {
    expect(ownerAccessError("profile_unavailable").code).toBe(
      ACCESS_ERROR.PROFILE_UNAVAILABLE,
    );
  });
});
