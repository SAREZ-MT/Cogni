import { beforeEach, describe, expect, it, vi } from "vitest";

// signInAction/signOutAction are Server Actions: everything that reaches
// Supabase or Next request APIs is mocked so these tests exercise real
// application-layer logic (signIn, SupabaseAuthGateway) without a network
// call (specs/identity-auth/spec.md, "Sesión por cookies con refresco en
// middleware", "Cierre de sesión").
const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

const { after } = vi.hoisted(() => ({
  after: vi.fn((callback: () => unknown) => callback()),
}));
vi.mock("next/server", () => ({ after }));

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/shared/observability/analytics", () => ({
  createServerAnalytics: () => ({ track }),
}));

vi.mock("@/shared/config/env.client", () => ({
  clientEnv: () => ({
    NEXT_PUBLIC_SITE_URL: "https://cogni.test",
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://app.posthog.com",
  }),
}));

const { acceptTermsUseCase } = vi.hoisted(() => ({
  acceptTermsUseCase: vi.fn(),
}));
vi.mock("./application", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./application")>();
  return { ...actual, acceptTerms: acceptTermsUseCase };
});

vi.mock("@/shared/db/client", () => ({ getDb: () => ({}) }));

const { getUser, signInWithPasswordMock, signOutMock, signInWithOAuthMock } =
  vi.hoisted(() => ({
    getUser: vi.fn(),
    signInWithPasswordMock: vi.fn(),
    signOutMock: vi.fn(),
    signInWithOAuthMock: vi.fn(),
  }));
vi.mock("./infrastructure", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./infrastructure")>();
  return {
    ...actual,
    createSupabaseServerClient: vi.fn(async () => ({
      auth: {
        getUser,
        signInWithPassword: signInWithPasswordMock,
        signOut: signOutMock,
        signInWithOAuth: signInWithOAuthMock,
      },
    })),
  };
});

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("signInAction", () => {
  beforeEach(() => {
    redirect.mockClear();
    after.mockClear();
    track.mockClear();
    getUser.mockClear();
    signInWithPasswordMock.mockReset();
  });

  it("takes the userId from the gateway result instead of querying auth.getUser() a second time", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "u-42" }, session: { access_token: "x" } },
      error: null,
    });
    const { signInAction } = await import("./actions");

    await signInAction(
      { status: "idle" },
      formData({ email: "ana@example.com", password: "secreta123" }),
    );

    expect(getUser).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("user_signed_in", "u-42");
    expect(redirect).toHaveBeenCalledWith("/");
  });
});

describe("signInWithGoogleAction", () => {
  beforeEach(() => {
    redirect.mockClear();
    signInWithOAuthMock.mockReset();
  });

  it("marks the callback URL with flow=google so a failed exchange shows the Google copy", async () => {
    signInWithOAuthMock.mockResolvedValue({
      data: { url: "https://accounts.google.test/o/oauth2" },
      error: null,
    });
    const { signInWithGoogleAction } = await import("./actions");

    await signInWithGoogleAction();

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://cogni.test/auth/callback?flow=google",
        skipBrowserRedirect: true,
      },
    });
    expect(redirect).toHaveBeenCalledWith(
      "https://accounts.google.test/o/oauth2",
    );
  });
});

describe("signOutAction", () => {
  beforeEach(() => {
    redirect.mockClear();
    signOutMock.mockReset();
  });

  it('redirects to /login on a successful sign-out (Scenario "Cierre exitoso")', async () => {
    signOutMock.mockResolvedValue({ error: null });
    const { signOutAction } = await import("./actions");

    const result = await signOutAction();

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(result).toBeUndefined();
  });

  it('returns the error and does not redirect when Supabase rejects sign-out (Scenario "Error al cerrar sesión no se oculta")', async () => {
    signOutMock.mockResolvedValue({
      error: { code: "over_request_rate_limit", message: "slow down" },
    });
    const { signOutAction } = await import("./actions");

    const result = await signOutAction();

    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "error",
      message:
        "No pudimos completar la acción. Inténtalo de nuevo en unos minutos.",
    });
  });
});

describe("acceptTermsAction", () => {
  beforeEach(() => {
    redirect.mockClear();
    track.mockClear();
    getUser.mockReset();
    acceptTermsUseCase.mockReset();
  });

  it("sends an anonymous visitor to /login without touching the use case", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { acceptTermsAction } = await import("./actions");

    await acceptTermsAction(
      { status: "idle" },
      formData({ accept: "on", next: "/notebooks" }),
    );

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(acceptTermsUseCase).not.toHaveBeenCalled();
  });

  it("returns the Spanish error and does not redirect when the box is unticked", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-42" } } });
    acceptTermsUseCase.mockResolvedValue({
      ok: false,
      error: { code: "TERMS_NOT_ACCEPTED" },
    });
    const { acceptTermsAction } = await import("./actions");

    const result = await acceptTermsAction(
      { status: "idle" },
      formData({ next: "/notebooks" }),
    );

    expect(acceptTermsUseCase).toHaveBeenCalledWith(
      { accepted: false },
      expect.anything(),
      "u-42",
    );
    expect(result).toEqual({
      status: "error",
      message: "Debes aceptar los términos para continuar.",
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("records the acceptance, tracks terms_accepted and redirects to the sanitised next", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-42" } } });
    acceptTermsUseCase.mockResolvedValue({
      ok: true,
      value: { termsAcceptedVersion: "2026-10-04" },
    });
    const { acceptTermsAction } = await import("./actions");

    await acceptTermsAction(
      { status: "idle" },
      formData({ accept: "on", next: "/notebooks" }),
    );

    expect(acceptTermsUseCase).toHaveBeenCalledWith(
      { accepted: true },
      expect.anything(),
      "u-42",
    );
    expect(track).toHaveBeenCalledWith("terms_accepted", "u-42", {
      version: "2026-10-04",
    });
    expect(redirect).toHaveBeenCalledWith("/notebooks");
  });

  it("falls back to / when next is an open redirect", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-42" } } });
    acceptTermsUseCase.mockResolvedValue({
      ok: true,
      value: { termsAcceptedVersion: "2026-10-04" },
    });
    const { acceptTermsAction } = await import("./actions");

    await acceptTermsAction(
      { status: "idle" },
      formData({ accept: "on", next: "//evil.example" }),
    );

    expect(redirect).toHaveBeenCalledWith("/");
  });
});
