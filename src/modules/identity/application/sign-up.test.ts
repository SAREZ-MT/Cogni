import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { AUTH_ERROR } from "../domain/auth-errors";
import { signUp } from "./sign-up";
import { FakeAuthGateway } from "./testing/fake-auth-gateway";

const SITE_URL = "https://cogni.test";
const NOW = new Date("2026-10-28T15:00:00.000Z");
const clock = createFixedClock(NOW);

describe("signUp", () => {
  it("attaches the server-side consent proof (terms version + server time) to the new account", async () => {
    const auth = new FakeAuthGateway();

    await signUp(
      { email: "ana@example.com", password: "secreta123" },
      { auth, siteUrl: SITE_URL, clock },
    );

    expect(auth.calls[0]).toMatchObject({
      method: "signUp",
      input: {
        userMetadata: {
          terms_version: "2026-10-28",
          consented_at: "2026-10-28T15:00:00.000Z",
          consent_method: "email",
        },
      },
    });
  });

  it("never trusts consent values sent by the client", async () => {
    const auth = new FakeAuthGateway();

    await signUp(
      {
        email: "ana@example.com",
        password: "secreta123",
        terms_version: "1999-01-01",
        consented_at: "1999-01-01T00:00:00.000Z",
        userMetadata: { terms_version: "forged" },
      },
      { auth, siteUrl: SITE_URL, clock },
    );

    expect(auth.calls[0]?.input).toMatchObject({
      userMetadata: {
        terms_version: "2026-10-28",
        consented_at: "2026-10-28T15:00:00.000Z",
      },
    });
  });

  it("registers a new user and reports that verification is pending", async () => {
    const auth = new FakeAuthGateway();

    const result = await signUp(
      { email: "ana@example.com", password: "secreta123" },
      { auth, siteUrl: SITE_URL, clock },
    );

    expect(result.ok && result.value).toEqual({
      outcome: "verification_sent",
      userId: expect.any(String),
    });
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
      { auth, siteUrl: SITE_URL, clock },
    );

    // No id for an existing email: nothing to correlate, nothing to leak.
    expect(result.ok && result.value).toEqual({
      outcome: "already_registered",
      userId: null,
    });
  });

  it("rejects an invalid email before reaching the gateway", async () => {
    const auth = new FakeAuthGateway();

    const result = await signUp(
      { email: "ana@", password: "secreta123" },
      { auth, siteUrl: SITE_URL, clock },
    );

    expect(!result.ok && result.error.code).toBe(AUTH_ERROR.INVALID_INPUT);
    expect(auth.calls).toHaveLength(0);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const auth = new FakeAuthGateway();

    const result = await signUp(
      { email: "ana@example.com", password: "corta" },
      { auth, siteUrl: SITE_URL, clock },
    );

    expect(!result.ok && result.error.code).toBe(AUTH_ERROR.INVALID_INPUT);
  });
});
