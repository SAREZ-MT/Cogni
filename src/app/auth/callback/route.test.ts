import { beforeEach, describe, expect, it, vi } from "vitest";

// Which error /auth/callback sends the visitor back to /login with. The
// callback serves three flows: Google OAuth (signInWithGoogleAction sets a
// short-lived `cogni_auth_flow=google` cookie scoped to /auth/callback and
// leaves the redirect URL untouched), sign-up email verification and
// password reset. Only a failed Google flow may show the "Google cancelled"
// copy; a failed or expired email link gets the link copy instead. The
// marker cookie is always cleared on the way out.
const { exchangeCodeForSession, safeNext, recordSignUpConsentForUser } =
  vi.hoisted(() => ({
    exchangeCodeForSession: vi.fn(),
    safeNext: vi.fn((next: string | null) => next ?? "/"),
    recordSignUpConsentForUser: vi.fn(
      async (): Promise<{ stamped: boolean; method?: string }> => ({
        stamped: false,
      }),
    ),
  }));
// The flow-cookie contract is pure (identity/domain/auth-flow.ts and
// application/sign-up.ts), so the mock spreads the real values instead of
// loading the server-only identity index.
vi.mock("@/modules/identity", async () => ({
  exchangeCodeForSession,
  safeNext,
  recordSignUpConsentForUser,
  ...(await import("@/modules/identity/domain/auth-flow")),
  ...(await import("@/modules/identity/domain/terms-consent")),
  TERMS_VERSION: (await import("@/modules/identity/domain/terms"))
    .TERMS_VERSION,
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

  it("finds the flow cookie among several cookies, by exact name", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });

    expect(
      await callback(
        "?code=bad",
        "sb-access=x; xcogni_auth_flow=google; cogni_auth_flow=google; theme=dark",
      ),
    ).toBe("https://cogni.test/login?error=google");
    expect(
      await callback(
        "?code=bad",
        "xcogni_auth_flow=google; cogni_auth_flow_x=google; a=b",
      ),
    ).toBe("https://cogni.test/login?error=link");
    expect(await callback("?code=bad", "cogni_auth_flow=googlex; a=b")).toBe(
      "https://cogni.test/login?error=link",
    );
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

describe("GET /auth/callback sign-up consent", () => {
  const CREATED_AT = new Date("2026-10-28T15:00:03Z");
  const CONSENT_COOKIE = "cogni_terms_consent=2026-10-28_1793199600000";

  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    recordSignUpConsentForUser.mockReset();
    recordSignUpConsentForUser.mockResolvedValue({ stamped: false });
    track.mockClear();
  });

  it("hands the account, its metadata and the request cookies to the consent stamp before redirecting", async () => {
    const metadata = { terms_version: "2026-10-28" };
    exchangeCodeForSession.mockResolvedValue({
      ok: true,
      userId: "u-1",
      createdAt: CREATED_AT,
      userMetadata: metadata,
    });
    const cookie = `${GOOGLE_FLOW_COOKIE}; ${CONSENT_COOKIE}`;

    expect(await callback("?code=abc", cookie)).toBe("https://cogni.test/");
    expect(recordSignUpConsentForUser).toHaveBeenCalledWith({
      userId: "u-1",
      accountCreatedAt: CREATED_AT,
      userMetadata: metadata,
      cookieHeader: cookie,
    });
  });

  it("tracks terms_accepted with source oauth_callback once a Google account is stamped", async () => {
    exchangeCodeForSession.mockResolvedValue({
      ok: true,
      userId: "u-1",
      createdAt: CREATED_AT,
      userMetadata: {},
    });
    recordSignUpConsentForUser.mockResolvedValue({
      stamped: true,
      method: "google",
    });

    await callback("?code=abc", `${GOOGLE_FLOW_COOKIE}; ${CONSENT_COOKIE}`);

    expect(track).toHaveBeenCalledWith("terms_accepted", "u-1", {
      version: "2026-10-28",
      source: "oauth_callback",
    });
  });

  it("does not repeat terms_accepted for an email account (already tracked at sign-up)", async () => {
    exchangeCodeForSession.mockResolvedValue({
      ok: true,
      userId: "u-1",
      createdAt: CREATED_AT,
      userMetadata: {},
    });
    recordSignUpConsentForUser.mockResolvedValue({
      stamped: true,
      method: "email",
    });

    await callback("?code=abc");

    expect(track).toHaveBeenCalledWith("user_signed_in", "u-1");
    expect(track).not.toHaveBeenCalledWith(
      "terms_accepted",
      expect.anything(),
      expect.anything(),
    );
  });

  it("never stamps on a failed exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });

    await callback("?code=bad", CONSENT_COOKIE);

    expect(recordSignUpConsentForUser).not.toHaveBeenCalled();
  });

  it("clears the consent cookie on success and failure", async () => {
    const clears = (response: Response) =>
      /cogni_terms_consent=;[^,]*Path=\/auth\/callback/i.test(
        response.headers.get("set-cookie") ?? "",
      );
    exchangeCodeForSession.mockResolvedValue({
      ok: true,
      userId: "u-1",
      createdAt: CREATED_AT,
      userMetadata: {},
    });
    expect(clears(await callbackResponse("?code=abc", CONSENT_COOKIE))).toBe(
      true,
    );

    exchangeCodeForSession.mockResolvedValue({ ok: false, userId: null });
    expect(clears(await callbackResponse("?code=bad", CONSENT_COOKIE))).toBe(
      true,
    );
  });
});
