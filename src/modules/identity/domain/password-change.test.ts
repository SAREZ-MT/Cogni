import { describe, expect, it } from "vitest";
import { isFreshRecoverySession, RECOVERY_WINDOW_MS } from "./password-change";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("isFreshRecoverySession", () => {
  it("accepts a session whose latest sign-in was a recent recovery link", () => {
    expect(
      isFreshRecoverySession([{ method: "recovery", at: ago(60_000) }], NOW),
    ).toBe(true);
  });

  it.each([
    "password",
    "oauth",
    "otp",
    "magiclink",
    "email/signup",
  ])("refuses a session that signed in with %s", (method) => {
    expect(isFreshRecoverySession([{ method, at: ago(60_000) }], NOW)).toBe(
      false,
    );
  });

  it("refuses a recovery link used longer ago than the window", () => {
    expect(
      isFreshRecoverySession(
        [{ method: "recovery", at: ago(RECOVERY_WINDOW_MS + 1) }],
        NOW,
      ),
    ).toBe(false);
  });

  it("accepts a recovery link used exactly at the edge of the window", () => {
    expect(
      isFreshRecoverySession(
        [{ method: "recovery", at: ago(RECOVERY_WINDOW_MS) }],
        NOW,
      ),
    ).toBe(true);
  });

  it("judges by the most recent event, whatever the order", () => {
    const recovery = { method: "recovery", at: ago(120_000) };
    const laterPassword = { method: "password", at: ago(60_000) };
    const earlierPassword = { method: "password", at: ago(600_000) };

    expect(isFreshRecoverySession([recovery, laterPassword], NOW)).toBe(false);
    expect(isFreshRecoverySession([earlierPassword, recovery], NOW)).toBe(true);
  });

  it("refuses a session with no authentication events", () => {
    expect(isFreshRecoverySession([], NOW)).toBe(false);
  });

  it("refuses a recovery dated in the future beyond the clock skew", () => {
    expect(
      isFreshRecoverySession([{ method: "recovery", at: ago(-120_000) }], NOW),
    ).toBe(false);
  });
});
