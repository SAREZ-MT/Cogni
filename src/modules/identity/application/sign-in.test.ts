import { describe, expect, it } from "vitest";
import { AUTH_ERROR } from "../domain/auth-errors";
import { signIn } from "./sign-in";
import { FakeAuthGateway } from "./testing/fake-auth-gateway";

describe("signIn", () => {
  it("signs a verified user in", async () => {
    const auth = new FakeAuthGateway();
    auth.seed({
      email: "ana@example.com",
      password: "secreta123",
      verified: true,
    });

    const result = await signIn(
      { email: "ana@example.com", password: "secreta123" },
      { auth },
    );

    expect(result.ok).toBe(true);
    expect(auth.signedIn).toBe("ana@example.com");
  });

  it("rejects an unverified user and asks for verification", async () => {
    const auth = new FakeAuthGateway();
    auth.seed({
      email: "ana@example.com",
      password: "secreta123",
      verified: false,
    });

    const result = await signIn(
      { email: "ana@example.com", password: "secreta123" },
      { auth },
    );

    expect(!result.ok && result.error.code).toBe(AUTH_ERROR.EMAIL_NOT_VERIFIED);
    expect(auth.signedIn).toBeNull();
  });

  it("answers wrong password and unknown email with the same error", async () => {
    const auth = new FakeAuthGateway();
    auth.seed({
      email: "ana@example.com",
      password: "secreta123",
      verified: true,
    });

    const wrongPassword = await signIn(
      { email: "ana@example.com", password: "incorrecta" },
      { auth },
    );
    const unknownEmail = await signIn(
      { email: "nadie@example.com", password: "secreta123" },
      { auth },
    );

    expect(!wrongPassword.ok && wrongPassword.error.code).toBe(
      AUTH_ERROR.INVALID_CREDENTIALS,
    );
    expect(!unknownEmail.ok && unknownEmail.error.code).toBe(
      AUTH_ERROR.INVALID_CREDENTIALS,
    );
  });

  it("validates input before calling the gateway", async () => {
    const auth = new FakeAuthGateway();

    const result = await signIn({ email: "", password: "" }, { auth });

    expect(!result.ok && result.error.code).toBe(AUTH_ERROR.INVALID_INPUT);
    expect(auth.calls).toHaveLength(0);
  });
});
