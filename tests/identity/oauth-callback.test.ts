import { beforeEach, describe, expect, it, vi } from "vitest";

// specs/observability-and-delivery/spec.md, "Evento `user_signed_in` en el
// callback de OAuth", Scenario "Inicio de sesión con Google emite evento".
const { exchangeCodeForSession, safeNext } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  safeNext: vi.fn((next: string | null) => next ?? "/"),
}));
// The flow-cookie contract is pure (identity/domain/auth-flow.ts and
// application/sign-up.ts), so the mock spreads the real values instead of
// loading the server-only identity index.
vi.mock("@/modules/identity", async () => ({
  exchangeCodeForSession,
  safeNext,
  ...(await import("@/modules/identity/domain/auth-flow")),
  AUTH_CALLBACK_PATH: (await import("@/modules/identity/application/sign-up"))
    .AUTH_CALLBACK_PATH,
}));

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/shared/observability/analytics", () => ({
  createServerAnalytics: () => ({ track }),
}));

vi.mock("@/shared/config/env.client", () => ({
  clientEnv: () => ({
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://app.posthog.com",
  }),
}));

const { after } = vi.hoisted(() => ({
  after: vi.fn((callback: () => unknown) => callback()),
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after };
});

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    track.mockClear();
    after.mockClear();
  });

  it("sends exactly one user_signed_in event when the session is established", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: true, userId: "u-1" });
    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(
      new Request("https://cogni.test/auth/callback?code=abc"),
    );

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("user_signed_in", "u-1");
    expect(response.status).toBe(307);
  });

  it("does not send an event when there is no code", async () => {
    const { GET } = await import("@/app/auth/callback/route");

    await GET(new Request("https://cogni.test/auth/callback"));

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("does not send an event when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });
    const { GET } = await import("@/app/auth/callback/route");

    await GET(new Request("https://cogni.test/auth/callback?code=bad"));

    expect(track).not.toHaveBeenCalled();
  });
});
