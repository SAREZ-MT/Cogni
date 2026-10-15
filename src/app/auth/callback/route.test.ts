import { beforeEach, describe, expect, it, vi } from "vitest";

// Which error /auth/callback sends the visitor back to /login with. The
// callback serves three flows: Google OAuth (whose redirectTo carries
// `flow=google`, identity/actions.ts), sign-up email verification and
// password reset. Only a failed Google flow may show the "Google cancelled"
// copy; a failed or expired email link gets the link copy instead.
const { exchangeCodeForSession, safeNext } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  safeNext: vi.fn((next: string | null) => next ?? "/"),
}));
vi.mock("@/modules/identity", () => ({ exchangeCodeForSession, safeNext }));

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

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (callback: () => unknown) => callback() };
});

async function callback(query: string): Promise<string | null> {
  const { GET } = await import("./route");
  const response = await GET(
    new Request(`https://cogni.test/auth/callback${query}`),
  );
  return response.headers.get("location");
}

describe("GET /auth/callback error selection", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    track.mockClear();
  });

  it("sends a failed Google exchange to /login?error=google", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });

    expect(await callback("?flow=google&code=bad")).toBe(
      "https://cogni.test/login?error=google",
    );
  });

  it("sends a failed email-link exchange to /login?error=link", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });

    expect(await callback("?code=expired")).toBe(
      "https://cogni.test/login?error=link",
    );
    expect(await callback("?code=expired&next=/reset-password")).toBe(
      "https://cogni.test/login?error=link",
    );
  });

  it("treats a Google callback without a code as a Google failure", async () => {
    expect(await callback("?flow=google")).toBe(
      "https://cogni.test/login?error=google",
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("treats any other callback without a code as an invalid link", async () => {
    expect(await callback("?next=//evil.tld")).toBe(
      "https://cogni.test/login?error=link",
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("keeps the success path: redirect to the sanitised next and track user_signed_in", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: true, userId: "u-1" });

    expect(await callback("?flow=google&code=abc&next=/cuadernos")).toBe(
      "https://cogni.test/cuadernos",
    );
    expect(safeNext).toHaveBeenCalledWith("/cuadernos");
    expect(track).toHaveBeenCalledWith("user_signed_in", "u-1");
  });
});
