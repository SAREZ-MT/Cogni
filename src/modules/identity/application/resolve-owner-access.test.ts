import { describe, expect, it, vi } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createProfile, type Profile } from "../domain/profile";
import { acceptTerms, TERMS_VERSION } from "../domain/terms";
import { resolveOwnerAccess } from "./resolve-owner-access";

const OWNER = "2f1b6f0e-6a55-4d0b-9d6c-0f6f1f1c2a01";
const clock = createFixedClock(new Date("2026-11-23T12:00:00Z"));

function acceptedProfile(): Profile {
  const created = createProfile({ id: OWNER }, clock);
  if (!created.ok) throw created.error;
  return acceptTerms(created.value, TERMS_VERSION, clock);
}

describe("resolveOwnerAccess", () => {
  it("grants a signed-in owner who accepted the current terms", async () => {
    const access = await resolveOwnerAccess({
      currentUser: async () => ({ id: OWNER }),
      loadProfile: async () => acceptedProfile(),
    });

    expect(access).toEqual({ status: "granted", ownerId: OWNER });
  });

  it("denies without a session and never reads a profile", async () => {
    const loadProfile = vi.fn(async () => acceptedProfile());

    const access = await resolveOwnerAccess({
      currentUser: async () => null,
      loadProfile,
    });

    expect(access).toEqual({ status: "denied", reason: "session_required" });
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it("loads the profile of the signed-in user", async () => {
    const loadProfile = vi.fn(async () => acceptedProfile());

    await resolveOwnerAccess({
      currentUser: async () => ({ id: OWNER }),
      loadProfile,
    });

    expect(loadProfile).toHaveBeenCalledWith(OWNER);
  });

  it("denies when the terms were not accepted", async () => {
    const created = createProfile({ id: OWNER }, clock);
    if (!created.ok) throw created.error;

    const access = await resolveOwnerAccess({
      currentUser: async () => ({ id: OWNER }),
      loadProfile: async () => created.value,
    });

    expect(access).toEqual({ status: "denied", reason: "terms_required" });
  });

  it("fails closed when the profile is missing", async () => {
    const access = await resolveOwnerAccess({
      currentUser: async () => ({ id: OWNER }),
      loadProfile: async () => null,
    });

    expect(access).toEqual({
      status: "denied",
      reason: "profile_unavailable",
    });
  });

  it("fails closed when the profile read throws", async () => {
    const access = await resolveOwnerAccess({
      currentUser: async () => ({ id: OWNER }),
      loadProfile: async () => {
        throw new Error("db down");
      },
    });

    expect(access).toEqual({
      status: "denied",
      reason: "profile_unavailable",
    });
  });
});
