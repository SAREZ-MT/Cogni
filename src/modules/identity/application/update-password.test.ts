import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { err } from "@/shared/kernel/result";
import { AUTH_ERROR } from "../domain/auth-errors";
import { FakeAuthGateway } from "./testing/fake-auth-gateway";
import { updatePassword } from "./update-password";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const clock = createFixedClock(NOW);
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000);

function gatewaySignedInWith(method: string, minutes = 1): FakeAuthGateway {
  const auth = new FakeAuthGateway();
  auth.authentication = [{ method, at: minutesAgo(minutes) }];
  return auth;
}

describe("updatePassword", () => {
  it("sets the new password for a session opened by a recovery link", async () => {
    const auth = gatewaySignedInWith("recovery");

    const result = await updatePassword(
      { password: "nueva-clave-123" },
      { auth, clock },
    );

    expect(result.ok).toBe(true);
    expect(auth.calls.at(-1)).toMatchObject({
      method: "updatePassword",
      input: { password: "nueva-clave-123" },
    });
  });

  it.each([
    "password",
    "oauth",
  ])("refuses a session that signed in with %s and changes nothing", async (method) => {
    const auth = gatewaySignedInWith(method);

    const result = await updatePassword(
      { password: "nueva-clave-123" },
      { auth, clock },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(AUTH_ERROR.RECOVERY_REQUIRED);
    }
    expect(auth.calls.map((call) => call.method)).not.toContain(
      "updatePassword",
    );
  });

  it("refuses a recovery link used too long ago", async () => {
    const auth = gatewaySignedInWith("recovery", 61);

    const result = await updatePassword(
      { password: "nueva-clave-123" },
      { auth, clock },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(AUTH_ERROR.RECOVERY_REQUIRED);
    }
  });

  it("refuses without a session", async () => {
    const auth = new FakeAuthGateway();

    const result = await updatePassword(
      { password: "nueva-clave-123" },
      { auth, clock },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(AUTH_ERROR.RECOVERY_REQUIRED);
    }
  });

  it("fails closed when the session cannot be read", async () => {
    const auth = gatewaySignedInWith("recovery");
    auth.authenticationFailure = err(
      new DomainError(AUTH_ERROR.PROVIDER_UNAVAILABLE, "claims unavailable"),
    );

    const result = await updatePassword(
      { password: "nueva-clave-123" },
      { auth, clock },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(AUTH_ERROR.PROVIDER_UNAVAILABLE);
    }
    expect(auth.calls.map((call) => call.method)).not.toContain(
      "updatePassword",
    );
  });

  it("rejects a short password before reading the session", async () => {
    const auth = gatewaySignedInWith("recovery");

    const result = await updatePassword({ password: "corta" }, { auth, clock });

    expect(result.ok).toBe(false);
    expect(auth.calls).toHaveLength(0);
  });
});
