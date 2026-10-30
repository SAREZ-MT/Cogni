import { describe, expect, it } from "vitest";
import { TERMS_VERSION } from "./terms";
import {
  consentAppliesToNewAccount,
  consentCookieValue,
  consentFromCookie,
  consentFromMetadata,
  signUpConsentMetadata,
  TERMS_CONSENT_COOKIE,
} from "./terms-consent";

const AT = new Date("2026-10-28T15:00:00.000Z");

describe("sign-up consent metadata (email)", () => {
  it("carries the current terms version and the server time", () => {
    expect(signUpConsentMetadata(AT)).toEqual({
      terms_version: TERMS_VERSION,
      consented_at: "2026-10-28T15:00:00.000Z",
      consent_method: "email",
    });
  });

  it("round-trips into an email consent", () => {
    expect(consentFromMetadata(signUpConsentMetadata(AT))).toEqual({
      version: TERMS_VERSION,
      consentedAt: AT,
      method: "email",
    });
  });

  it("ignores metadata without a valid version or date", () => {
    expect(consentFromMetadata(null)).toBeNull();
    expect(consentFromMetadata({})).toBeNull();
    expect(
      consentFromMetadata({ terms_version: TERMS_VERSION, consented_at: "x" }),
    ).toBeNull();
    expect(
      consentFromMetadata({ terms_version: 7, consented_at: AT.toISOString() }),
    ).toBeNull();
  });
});

describe("consent intent cookie (Google)", () => {
  it("round-trips into a Google consent", () => {
    const header = `a=b; ${TERMS_CONSENT_COOKIE}=${consentCookieValue(AT)}`;
    expect(consentFromCookie(header)).toEqual({
      version: TERMS_VERSION,
      consentedAt: AT,
      method: "google",
    });
  });

  it("matches the cookie name exactly and rejects garbage", () => {
    const value = consentCookieValue(AT);
    expect(consentFromCookie(null)).toBeNull();
    expect(consentFromCookie(`x${TERMS_CONSENT_COOKIE}=${value}`)).toBeNull();
    expect(consentFromCookie(`${TERMS_CONSENT_COOKIE}=nope`)).toBeNull();
    expect(
      consentFromCookie(`${TERMS_CONSENT_COOKIE}=2026-10-28_abc`),
    ).toBeNull();
  });
});

describe("consentAppliesToNewAccount", () => {
  const consent = {
    version: TERMS_VERSION,
    consentedAt: AT,
    method: "google" as const,
  };

  it("accepts an account created during the consent window", () => {
    expect(
      consentAppliesToNewAccount(consent, new Date("2026-10-28T15:00:05Z")),
    ).toBe(true);
    expect(
      consentAppliesToNewAccount(consent, new Date("2026-10-28T15:09:00Z")),
    ).toBe(true);
  });

  it("rejects an account that existed before the consent (a returning user)", () => {
    expect(
      consentAppliesToNewAccount(consent, new Date("2026-10-01T00:00:00Z")),
    ).toBe(false);
  });

  it("rejects an account created long after the consent", () => {
    expect(
      consentAppliesToNewAccount(consent, new Date("2026-10-28T16:00:00Z")),
    ).toBe(false);
  });

  it("rejects a consent given to another terms version", () => {
    expect(
      consentAppliesToNewAccount(
        { ...consent, version: "2026-10-04" },
        new Date("2026-10-28T15:00:05Z"),
      ),
    ).toBe(false);
  });
});
