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

const { getUser, signInWithPasswordMock, signOutMock } = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
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
