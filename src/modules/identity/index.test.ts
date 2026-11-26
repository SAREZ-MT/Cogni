import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

// getCurrentTimeZoneSetting (Phase 7 T2a): the shell's read of the profile
// time zone. A read failure must stay distinguishable from "not chosen yet"
// (Configuración would otherwise offer to overwrite the stored zone), and
// Next.js control flow must reach the framework.
vi.mock("server-only", () => ({}));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException }));

const { getUser, findById } = vi.hoisted(() => ({
  getUser: vi.fn(),
  findById: vi.fn(),
}));
vi.mock("./infrastructure", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
  DrizzleProfileRepository: vi.fn(function DrizzleProfileRepository() {
    return { findById };
  }),
}));

import { TERMS_VERSION } from "./domain";
import { getCurrentTimeZoneSetting, requireOwner } from "./index";

beforeEach(() => {
  getUser.mockReset();
  findById.mockReset();
  captureException.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u-42", email: null } } });
});

describe("getCurrentTimeZoneSetting", () => {
  it("reads the stored zone as chosen", async () => {
    findById.mockResolvedValue({ timezone: "America/Bogota" });

    expect(await getCurrentTimeZoneSetting()).toEqual({
      status: "ok",
      timeZone: "America/Bogota",
      chosen: true,
    });
  });

  it("returns the unchosen default without a session and reads no profile", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await getCurrentTimeZoneSetting()).toEqual({
      status: "ok",
      timeZone: "UTC",
      chosen: false,
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it("reports a read failure explicitly, with the UTC display fallback", async () => {
    const boom = new Error("db down");
    findById.mockRejectedValue(boom);

    // No `chosen` on a failure: the read cannot tell whether a zone was
    // chosen, so the result must not claim "unchosen".
    expect(await getCurrentTimeZoneSetting()).toStrictEqual({
      status: "failed",
      timeZone: "UTC",
    });
    expect(captureException).toHaveBeenCalledWith(boom);
  });

  it("rethrows Next.js control flow instead of degrading it", async () => {
    let control: unknown;
    try {
      redirect("/login");
    } catch (error) {
      control = error;
    }
    findById.mockRejectedValue(control);

    await expect(getCurrentTimeZoneSetting()).rejects.toBe(control);
    expect(captureException).not.toHaveBeenCalled();
  });
});

// requireOwner (security hardening S4a): the production wiring of the owner
// gate, session from Supabase and profile from the repository.
describe("requireOwner", () => {
  const acceptedProfile = {
    id: "u-42",
    termsAcceptedVersion: TERMS_VERSION,
  };

  it("grants the session user whose profile accepted the current terms", async () => {
    findById.mockResolvedValue(acceptedProfile);

    expect(await requireOwner()).toEqual({
      status: "granted",
      ownerId: "u-42",
    });
    expect(findById).toHaveBeenCalledWith("u-42");
  });

  it("denies without a session and reads no profile", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await requireOwner()).toEqual({
      status: "denied",
      reason: "session_required",
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it("denies a profile with pending terms", async () => {
    findById.mockResolvedValue({
      ...acceptedProfile,
      termsAcceptedVersion: null,
    });

    expect(await requireOwner()).toEqual({
      status: "denied",
      reason: "terms_required",
    });
  });

  it("fails closed and reports when the profile cannot be read", async () => {
    findById.mockRejectedValue(new Error("db down"));

    expect(await requireOwner()).toEqual({
      status: "denied",
      reason: "profile_unavailable",
    });
    expect(captureException).toHaveBeenCalled();
  });
});
