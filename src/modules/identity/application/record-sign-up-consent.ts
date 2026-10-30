import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import {
  consentAppliesToNewAccount,
  type TermsConsent,
} from "../domain/terms-consent";
import { type EnsureProfileDeps, ensureProfile } from "./ensure-profile";

export type RecordedSignUpConsent =
  | { stamped: true; method: TermsConsent["method"] }
  | { stamped: false };

// Copies the sign-up proof (email metadata or Google intent cookie) into
// the profile the first time it is created or ensured, with the consent
// time (not this request's time). Only a brand-new account with no
// acceptance yet is stamped; anything else is left to the /terminos gate.
// `consents` are the candidate proofs in priority order (the Google intent
// cookie, then the email metadata); the first one that covers this account
// is used.
export async function recordSignUpConsent(
  input: {
    ownerId: string;
    consents: readonly (TermsConsent | null)[];
    accountCreatedAt: Date | null;
  },
  deps: EnsureProfileDeps,
): Promise<Result<RecordedSignUpConsent, DomainError>> {
  const { accountCreatedAt } = input;
  const consent = accountCreatedAt
    ? input.consents.find(
        (candidate): candidate is TermsConsent =>
          candidate !== null &&
          consentAppliesToNewAccount(candidate, accountCreatedAt),
      )
    : undefined;
  if (!consent) return ok({ stamped: false });

  const ensured = await ensureProfile({ ownerId: input.ownerId }, deps);
  if (!ensured.ok) return ensured;
  if (ensured.value.termsAcceptedVersion !== null) {
    return ok({ stamped: false });
  }

  const saved = await deps.profiles.acceptTerms(
    input.ownerId,
    consent.version,
    consent.consentedAt,
    { method: consent.method, onlyIfUnaccepted: true },
  );
  return ok(
    saved ? { stamped: true, method: consent.method } : { stamped: false },
  );
}
