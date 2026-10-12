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

import { getCurrentTimeZoneSetting } from "./index";

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

  it("reports a read failure explicitly, with the UTC display fallback", async () => {
    const boom = new Error("db down");
    findById.mockRejectedValue(boom);

    expect(await getCurrentTimeZoneSetting()).toEqual({
      status: "failed",
      timeZone: "UTC",
      chosen: false,
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
