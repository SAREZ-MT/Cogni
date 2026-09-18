import { describe, expect, it } from "vitest";
import { AUTH_ERROR } from "../domain/auth-errors";
import { signUp } from "./sign-up";
import { FakeAuthGateway } from "./testing/fake-auth-gateway";

const SITE_URL = "https://cogni.test";

describe("signUp", () => {
  it("registers a new user and reports that verification is pending", async () => {
    const auth = new FakeAuthGateway();

    const result = await signUp(
      { email: "ana@example.com", password: "secreta123" },
      { auth, siteUrl: SITE_URL },
    );

    expect(result.ok && result.value).toBe("verification_sent");
    expect(auth.calls[0]).toMatchObject({
      method: "signUp",
      input: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    });
  });

  it("tells an existing email to sign in instead", async () => {
    const auth = new FakeAuthGateway();
    auth.seed({ email: "ana@example.com", password: "otra", verified: true });

    const result = await signUp(
      { email: "ana@example.com", password: "secreta123" },
      { auth, siteUrl: SITE_URL },
    );

    expect(result.ok && result.value).toBe("already_registered");
  });

  it("rejects an invalid email before reaching the gateway", async () => {
    const auth = new FakeAuthGateway();

    const result = await signUp(
      { email: "ana@", password: "secreta123" },
      { auth, siteUrl: SITE_URL },
    );

    expect(!result.ok && result.error.code).toBe(AUTH_ERROR.INVALID_INPUT);
    expect(auth.calls).toHaveLength(0);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const auth = new FakeAuthGateway();

    const result = await signUp(
      { email: "ana@example.com", password: "corta" },
      { auth, siteUrl: SITE_URL },
    );

    expect(!result.ok && result.error.code).toBe(AUTH_ERROR.INVALID_INPUT);
  });
});
