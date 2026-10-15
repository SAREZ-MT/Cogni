import { beforeEach, describe, expect, it, vi } from "vitest";

// Which error /auth/callback sends the visitor back to /login with. The
// callback serves three flows: Google OAuth (signInWithGoogleAction sets a
// short-lived `cogni_auth_flow=google` cookie scoped to /auth/callback and
// leaves the redirect URL untouched), sign-up email verification and
// password reset. Only a failed Google flow may show the "Google cancelled"
// copy; a failed or expired email link gets the link copy instead. The
// marker cookie is always cleared on the way out.
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

const GOOGLE_FLOW_COOKIE = "cogni_auth_flow=google";

async function callbackResponse(
  query: string,
  cookie?: string,
): Promise<Response> {
  const { GET } = await import("./route");
  return GET(
    new Request(`https://cogni.test/auth/callback${query}`, {
      headers: cookie ? { cookie } : {},
    }),
  );
}

async function callback(query: string, cookie?: string) {
  return (await callbackResponse(query, cookie)).headers.get("location");
}

function clearsFlowCookie(response: Response): boolean {
  const header = response.headers.get("set-cookie") ?? "";
  return (
    /cogni_auth_flow=;/.test(header) &&
    /Path=\/auth\/callback/i.test(header) &&
    /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(header)
  );
}

describe("GET /auth/callback error selection", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    track.mockClear();
  });

  it("sends a failed Google exchange (flow cookie) to /login?error=google", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });

    expect(await callback("?code=bad", GOOGLE_FLOW_COOKIE)).toBe(
      "https://cogni.test/login?error=google",
    );
  });

  it("sends a failed email-link exchange (no flow cookie) to /login?error=link", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });

    expect(await callback("?code=expired")).toBe(
      "https://cogni.test/login?error=link",
    );
    expect(await callback("?code=expired&next=/reset-password")).toBe(
      "https://cogni.test/login?error=link",
    );
  });

  it("ignores the old ?flow=google query marker", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });

    expect(await callback("?flow=google&code=bad")).toBe(
      "https://cogni.test/login?error=link",
    );
  });

  it("treats a Google callback without a code as a Google failure", async () => {
    expect(await callback("", GOOGLE_FLOW_COOKIE)).toBe(
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

    expect(
      await callback("?code=abc&next=/cuadernos", GOOGLE_FLOW_COOKIE),
    ).toBe("https://cogni.test/cuadernos");
    expect(safeNext).toHaveBeenCalledWith("/cuadernos");
    expect(track).toHaveBeenCalledWith("user_signed_in", "u-1");
  });

  it("clears the flow cookie on success, failure and no-code responses", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: true, userId: "u-1" });
    expect(
      clearsFlowCookie(await callbackResponse("?code=abc", GOOGLE_FLOW_COOKIE)),
    ).toBe(true);

    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });
    expect(
      clearsFlowCookie(await callbackResponse("?code=bad", GOOGLE_FLOW_COOKIE)),
    ).toBe(true);
    expect(clearsFlowCookie(await callbackResponse("?code=bad"))).toBe(true);

    expect(
      clearsFlowCookie(await callbackResponse("", GOOGLE_FLOW_COOKIE)),
    ).toBe(true);
  });
});
