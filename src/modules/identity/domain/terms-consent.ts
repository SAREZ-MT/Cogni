import { AUTH_FLOW_COOKIE_MAX_AGE_SECONDS } from "./auth-flow";
import { TERMS_VERSION } from "./terms";

// Proof that a new account accepted the terms and authorised the data
// processing BEFORE it existed (sign-in-wrap notice next to the sign-up and
// Google buttons, feature legal-consent L2). Both values are always set by
// the server, never read from the submitted form:
// - email: signUp stores them in the Supabase user metadata;
// - Google: signInWithGoogleAction sets a short-lived httpOnly cookie
//   scoped to the callback path, read once by /auth/callback.
// /auth/callback copies the proof into profiles.terms_accepted_* the first
// time, only while the profile has no acceptance yet.

// `gate` is the /terminos fallback form (existing accounts, version bumps).
export type TermsAcceptanceMethod = "email" | "google" | "gate";

export interface TermsConsent {
  version: string;
  consentedAt: Date;
  method: "email" | "google";
}

export const TERMS_CONSENT_COOKIE = "cogni_terms_consent";
// Same lifetime as the Google flow marker it travels with.
export const TERMS_CONSENT_COOKIE_MAX_AGE_SECONDS =
  AUTH_FLOW_COOKIE_MAX_AGE_SECONDS;

// Supabase user-metadata keys written at email sign-up.
export function signUpConsentMetadata(now: Date): Record<string, string> {
  return {
    terms_version: TERMS_VERSION,
    consented_at: now.toISOString(),
    consent_method: "email",
  };
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function consentFromMetadata(metadata: unknown): TermsConsent | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const version = record.terms_version;
  const consentedAt = validDate(record.consented_at);
  if (typeof version !== "string" || !consentedAt) return null;
  return { version, consentedAt, method: "email" };
}

// `<version>_<epoch ms>`: only cookie-safe characters.
export function consentCookieValue(now: Date): string {
  return `${TERMS_VERSION}_${now.getTime()}`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return null;
}

export function consentFromCookie(header: string | null): TermsConsent | null {
  const value = readCookie(header, TERMS_CONSENT_COOKIE);
  if (!value) return null;
  const separator = value.lastIndexOf("_");
  if (separator <= 0) return null;
  const millis = value.slice(separator + 1);
  if (!/^\d+$/.test(millis)) return null;
  const consentedAt = validDate(Number(millis));
  if (!consentedAt) return null;
  return { version: value.slice(0, separator), consentedAt, method: "google" };
}

// Clock skew allowed between this server and Supabase Auth.
const SKEW_MS = 60_000;

// The consent covers an account only when it is for the current terms and
// the account was created right after it: during the email sign-up call,
// or during the Google round trip the cookie lives for. A returning user
// (account older than the consent) is never stamped from the notice; the
// gate asks them instead.
export function consentAppliesToNewAccount(
  consent: TermsConsent,
  accountCreatedAt: Date,
): boolean {
  if (consent.version !== TERMS_VERSION) return false;
  const delta = accountCreatedAt.getTime() - consent.consentedAt.getTime();
  return (
    delta >= -SKEW_MS &&
    delta <= TERMS_CONSENT_COOKIE_MAX_AGE_SECONDS * 1000 + SKEW_MS
  );
}
