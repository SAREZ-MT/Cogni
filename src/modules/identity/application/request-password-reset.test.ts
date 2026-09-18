import { describe, expect, it } from "vitest";
import { requestPasswordReset } from "./request-password-reset";
import { FakeAuthGateway } from "./testing/fake-auth-gateway";
import { updatePassword } from "./update-password";

const SITE_URL = "https://cogni.test";

describe("requestPasswordReset", () => {
  it("asks the gateway to send the link to the reset page", async () => {
    const auth = new FakeAuthGateway();

    const result = await requestPasswordReset(
      { email: "ana@example.com" },
      { auth, siteUrl: SITE_URL },
    );

    expect(result.ok).toBe(true);
    expect(auth.calls[0]).toMatchObject({
      method: "requestPasswordReset",
      input: {
        email: "ana@example.com",
        redirectTo: `${SITE_URL}/auth/callback?next=/reset-password`,
      },
    });
  });

  it("answers identically for an unknown email", async () => {
    const auth = new FakeAuthGateway();
    auth.seed({ email: "ana@example.com", password: "x", verified: true });

    const known = await requestPasswordReset(
      { email: "ana@example.com" },
      { auth, siteUrl: SITE_URL },
    );
    const unknown = await requestPasswordReset(
      { email: "nadie@example.com" },
      { auth, siteUrl: SITE_URL },
    );

    expect(known).toEqual(unknown);
  });

  it("rejects a malformed email without calling the gateway", async () => {
    const auth = new FakeAuthGateway();

    const result = await requestPasswordReset(
      { email: "ana" },
      { auth, siteUrl: SITE_URL },
    );

    expect(result.ok).toBe(false);
    expect(auth.calls).toHaveLength(0);
  });
});

describe("updatePassword", () => {
  it("forwards a valid new password", async () => {
    const auth = new FakeAuthGateway();

    const result = await updatePassword(
      { password: "nueva-clave-123" },
      { auth },
    );

    expect(result.ok).toBe(true);
    expect(auth.calls[0]).toMatchObject({ method: "updatePassword" });
  });

  it("rejects a short password", async () => {
    const auth = new FakeAuthGateway();

    const result = await updatePassword({ password: "corta" }, { auth });

    expect(result.ok).toBe(false);
    expect(auth.calls).toHaveLength(0);
  });
});
