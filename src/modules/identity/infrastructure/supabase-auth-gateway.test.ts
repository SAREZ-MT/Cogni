import { describe, expect, it, vi } from "vitest";
import { AUTH_ERROR } from "../domain/auth-errors";
import { SupabaseAuthGateway } from "./supabase-auth-gateway";

type Script = Record<string, unknown>;

// Minimal stand-in for supabase.auth: each method resolves the scripted value.
function fakeAuth(script: Script) {
  const auth = {
    signUp: async () => script.signUp,
    signInWithPassword: async () => script.signInWithPassword,
    signOut: async () => script.signOut ?? { error: null },
    resetPasswordForEmail: async () =>
      script.resetPasswordForEmail ?? { error: null },
    updateUser: async () => script.updateUser ?? { error: null },
    signInWithOAuth: async () => script.signInWithOAuth,
  };
  return new SupabaseAuthGateway(
    auth as unknown as ConstructorParameters<typeof SupabaseAuthGateway>[0],
  );
}

const INPUT = {
  email: "ana@example.com",
  password: "secreta123",
  emailRedirectTo: "x",
  userMetadata: {
    terms_version: "2026-10-28",
    consented_at: "2026-10-28T15:00:00.000Z",
    consent_method: "email",
  },
};

describe("SupabaseAuthGateway", () => {
  it("passes the consent proof to Supabase as user metadata (options.data)", async () => {
    const signUp = vi.fn(async () => ({
      data: { user: { id: "u-1", identities: [{}] } },
      error: null,
    }));
    const gateway = new SupabaseAuthGateway({
      signUp,
    } as unknown as ConstructorParameters<typeof SupabaseAuthGateway>[0]);

    await gateway.signUp(INPUT);

    expect(signUp).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "secreta123",
      options: {
        emailRedirectTo: "x",
        data: {
          terms_version: "2026-10-28",
          consented_at: "2026-10-28T15:00:00.000Z",
          consent_method: "email",
        },
      },
    });
  });

  it("reports verification_sent for a brand new user", async () => {
    const gateway = fakeAuth({
      signUp: {
        data: { user: { id: "u-1", identities: [{}] } },
        error: null,
      },
    });

    expect(await gateway.signUp(INPUT)).toEqual({
      ok: true,
      value: { outcome: "verification_sent", userId: "u-1" },
    });
  });

  it("detects the obfuscated user Supabase returns for an existing email", async () => {
    const gateway = fakeAuth({
      signUp: {
        data: { user: { id: "u-fake", identities: [] } },
        error: null,
      },
    });

    expect(await gateway.signUp(INPUT)).toEqual({
      ok: true,
      value: { outcome: "already_registered", userId: null },
    });
  });

  it("maps email_not_confirmed and invalid_credentials to domain codes", async () => {
    const unverified = fakeAuth({
      signInWithPassword: {
        error: { code: "email_not_confirmed", message: "x" },
      },
    });
    const wrong = fakeAuth({
      signInWithPassword: {
        error: { code: "invalid_credentials", message: "x" },
      },
    });

    const a = await unverified.signInWithPassword(INPUT);
    const b = await wrong.signInWithPassword(INPUT);

    expect(!a.ok && a.error.code).toBe(AUTH_ERROR.EMAIL_NOT_VERIFIED);
    expect(!b.ok && b.error.code).toBe(AUTH_ERROR.INVALID_CREDENTIALS);
  });

  it('exposes the userId from a successful sign-in (Scenario "Gateway de sign-in expone userId")', async () => {
    const gateway = fakeAuth({
      signInWithPassword: {
        data: { user: { id: "u-77" }, session: { access_token: "x" } },
        error: null,
      },
    });

    const result = await gateway.signInWithPassword(INPUT);

    expect(result).toEqual({ ok: true, value: { userId: "u-77" } });
  });

  it("hides unknown provider failures behind PROVIDER_UNAVAILABLE", async () => {
    const gateway = fakeAuth({
      signInWithPassword: {
        error: { code: "over_request_rate_limit", message: "slow down" },
      },
    });

    const result = await gateway.signInWithPassword(INPUT);

    expect(!result.ok && result.error.code).toBe(
      AUTH_ERROR.PROVIDER_UNAVAILABLE,
    );
  });

  it("returns the Google authorization url without redirecting", async () => {
    const gateway = fakeAuth({
      signInWithOAuth: {
        data: { url: "https://accounts.google.com/x" },
        error: null,
      },
    });

    const result = await gateway.startGoogleSignIn({
      redirectTo: "https://cogni.test/auth/callback",
    });

    expect(result.ok && result.value.url).toBe("https://accounts.google.com/x");
  });
});
