import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { TERMS_VERSION } from "../domain/terms";
import { ensureProfile } from "./ensure-profile";
import { recordSignUpConsent } from "./record-sign-up-consent";
import { InMemoryProfileRepository } from "./testing/in-memory-profile-repository";

const OWNER_ID = "3f1a6c1e-6a0b-4d7e-9a51-0f4b8f7a2c11";
const CONSENTED_AT = new Date("2026-10-28T15:00:00Z");
const CREATED_AT = new Date("2026-10-28T15:00:02Z");
// The first callback runs minutes later: the stamp must keep the consent
// time, not this one.
const CALLBACK_AT = new Date("2026-10-28T15:07:00Z");

function deps() {
  return {
    profiles: new InMemoryProfileRepository(),
    clock: createFixedClock(CALLBACK_AT),
  };
}

const EMAIL_CONSENT = {
  version: TERMS_VERSION,
  consentedAt: CONSENTED_AT,
  method: "email" as const,
};

describe("recordSignUpConsent", () => {
  it("creates the profile and stamps the consent time, version and method", async () => {
    const d = deps();

    const result = await recordSignUpConsent(
      {
        ownerId: OWNER_ID,
        consents: [EMAIL_CONSENT],
        accountCreatedAt: CREATED_AT,
      },
      d,
    );

    expect(result).toEqual({
      ok: true,
      value: { stamped: true, method: "email" },
    });
    const profile = await d.profiles.findById(OWNER_ID);
    expect(profile).toMatchObject({
      termsAcceptedVersion: TERMS_VERSION,
      termsAcceptedAt: CONSENTED_AT,
      termsAcceptedMethod: "email",
    });
  });

  it("never overwrites an existing acceptance", async () => {
    const d = deps();
    await recordSignUpConsent(
      {
        ownerId: OWNER_ID,
        consents: [EMAIL_CONSENT],
        accountCreatedAt: CREATED_AT,
      },
      d,
    );

    const again = await recordSignUpConsent(
      {
        ownerId: OWNER_ID,
        consents: [
          { ...EMAIL_CONSENT, method: "google", consentedAt: CREATED_AT },
        ],
        accountCreatedAt: CREATED_AT,
      },
      d,
    );

    expect(again).toEqual({ ok: true, value: { stamped: false } });
    expect(await d.profiles.findById(OWNER_ID)).toMatchObject({
      termsAcceptedAt: CONSENTED_AT,
      termsAcceptedMethod: "email",
    });
  });

  it("keeps an old-version acceptance for the gate to re-ask", async () => {
    const d = deps();
    await ensureProfile({ ownerId: OWNER_ID }, d);
    await d.profiles.acceptTerms(OWNER_ID, "2026-10-04", CONSENTED_AT, {
      method: "gate",
    });

    const result = await recordSignUpConsent(
      {
        ownerId: OWNER_ID,
        consents: [EMAIL_CONSENT],
        accountCreatedAt: CREATED_AT,
      },
      d,
    );

    expect(result).toEqual({ ok: true, value: { stamped: false } });
    expect(await d.profiles.findById(OWNER_ID)).toMatchObject({
      termsAcceptedVersion: "2026-10-04",
    });
  });

  it("uses the first candidate that covers the new account", async () => {
    const d = deps();
    const staleGoogle = {
      ...EMAIL_CONSENT,
      method: "google" as const,
      consentedAt: new Date("2026-10-28T13:00:00Z"),
    };

    const result = await recordSignUpConsent(
      {
        ownerId: OWNER_ID,
        consents: [staleGoogle, EMAIL_CONSENT],
        accountCreatedAt: CREATED_AT,
      },
      d,
    );

    expect(result).toEqual({
      ok: true,
      value: { stamped: true, method: "email" },
    });
  });

  it("stamps nothing without a consent or for a returning account", async () => {
    const d = deps();

    expect(
      await recordSignUpConsent(
        { ownerId: OWNER_ID, consents: [null], accountCreatedAt: CREATED_AT },
        d,
      ),
    ).toEqual({ ok: true, value: { stamped: false } });
    expect(
      await recordSignUpConsent(
        {
          ownerId: OWNER_ID,
          consents: [{ ...EMAIL_CONSENT, method: "google" }],
          accountCreatedAt: new Date("2026-09-01T00:00:00Z"),
        },
        d,
      ),
    ).toEqual({ ok: true, value: { stamped: false } });
    // Nothing to stamp: the profile is left to the (app) layout.
    expect(await d.profiles.findById(OWNER_ID)).toBeNull();
  });
});
