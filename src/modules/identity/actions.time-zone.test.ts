import { beforeEach, describe, expect, it, vi } from "vitest";

// Time-zone Server Actions (Configuración, Phase 7 T2a): session first,
// validation through the application layer, Spanish form feedback, and
// never a thrown error towards the client.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/shared/observability/analytics", () => ({
  createServerAnalytics: () => ({ track: vi.fn() }),
}));
vi.mock("@/shared/config/env.client", () => ({ clientEnv: () => ({}) }));
vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException }));

const { updateProfileTimeZone, adoptBrowserTimeZone } = vi.hoisted(() => ({
  updateProfileTimeZone: vi.fn(),
  adoptBrowserTimeZone: vi.fn(),
}));
vi.mock("./application", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./application")>();
  return { ...actual, updateProfileTimeZone, adoptBrowserTimeZone };
});

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("./infrastructure", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./infrastructure")>();
  return {
    ...actual,
    createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
  };
});

import { adoptBrowserTimeZoneAction, updateTimeZoneAction } from "./actions";
import { PROFILE_ERROR } from "./domain/time-zone";
import { TIME_ZONE_COPY } from "./ui/time-zone-copy";

function formWith(timeZone: string): FormData {
  const data = new FormData();
  data.set("timeZone", timeZone);
  return data;
}

const IDLE = { status: "idle" } as const;

beforeEach(() => {
  getUser.mockReset();
  updateProfileTimeZone.mockReset();
  adoptBrowserTimeZone.mockReset();
  captureException.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u-42" } } });
});

describe("updateTimeZoneAction", () => {
  it("saves the submitted zone for the session user and confirms it", async () => {
    updateProfileTimeZone.mockResolvedValue({
      ok: true,
      value: { timezone: "America/Bogota" },
    });

    const state = await updateTimeZoneAction(IDLE, formWith("America/Bogota"));

    expect(updateProfileTimeZone).toHaveBeenCalledWith(
      { ownerId: "u-42", timeZone: "America/Bogota" },
      expect.objectContaining({ profiles: expect.anything() }),
    );
    expect(state).toEqual({
      status: "success",
      message: TIME_ZONE_COPY.saved,
      timeZone: "America/Bogota",
    });
  });

  it("explains an invalid zone in Spanish", async () => {
    updateProfileTimeZone.mockResolvedValue({
      ok: false,
      error: { code: PROFILE_ERROR.INVALID_TIME_ZONE },
    });

    const state = await updateTimeZoneAction(IDLE, formWith("Mars/Base"));

    expect(state).toEqual({
      status: "error",
      message: TIME_ZONE_COPY.invalid,
    });
  });

  it("asks an anonymous caller to sign in without touching the use case", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const state = await updateTimeZoneAction(IDLE, formWith("America/Bogota"));

    expect(state).toEqual({
      status: "error",
      message: TIME_ZONE_COPY.sessionRequired,
    });
    expect(updateProfileTimeZone).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure to Sentry and returns a generic error", async () => {
    const boom = new Error("db down");
    updateProfileTimeZone.mockRejectedValue(boom);

    const state = await updateTimeZoneAction(IDLE, formWith("America/Bogota"));

    expect(captureException).toHaveBeenCalledWith(boom);
    expect(state).toEqual({
      status: "error",
      message: TIME_ZONE_COPY.failed,
    });
  });
});

describe("adoptBrowserTimeZoneAction", () => {
  it("adopts the detected zone for the session user", async () => {
    adoptBrowserTimeZone.mockResolvedValue({
      ok: true,
      value: { adopted: true, timeZone: "America/Bogota" },
    });

    const result = await adoptBrowserTimeZoneAction("America/Bogota");

    expect(adoptBrowserTimeZone).toHaveBeenCalledWith(
      { ownerId: "u-42", timeZone: "America/Bogota" },
      expect.objectContaining({ profiles: expect.anything() }),
    );
    expect(result).toEqual({ ok: true, adopted: true });
  });

  it("returns ok: false for an invalid detection", async () => {
    adoptBrowserTimeZone.mockResolvedValue({
      ok: false,
      error: { code: PROFILE_ERROR.INVALID_TIME_ZONE },
    });

    expect(await adoptBrowserTimeZoneAction("+05:00")).toEqual({ ok: false });
  });

  it("returns ok: false without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await adoptBrowserTimeZoneAction("America/Bogota")).toEqual({
      ok: false,
    });
    expect(adoptBrowserTimeZone).not.toHaveBeenCalled();
  });

  it("never throws: a failure is reported and returns ok: false", async () => {
    const boom = new Error("db down");
    adoptBrowserTimeZone.mockRejectedValue(boom);

    expect(await adoptBrowserTimeZoneAction("America/Bogota")).toEqual({
      ok: false,
    });
    expect(captureException).toHaveBeenCalledWith(boom);
  });
});
