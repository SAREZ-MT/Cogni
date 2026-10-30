import { TextLink } from "@/shared/ui/text-link";
import { TERMS_COPY } from "./terms-copy";

// Sign-in-wrap consent notice (feature legal-consent L2): rendered right
// next to every button that can create an account — the sign-up submit and
// "Continuar con Google" on /register, "Continuar con Google" on /login —
// and referenced by those buttons through aria-describedby (`id`). There is
// no checkbox by design: pressing the button is the acceptance, and the
// server records the proof before the account exists (signUp metadata for
// email, the consent-intent cookie for Google; domain/terms-consent.ts).
// The (app) gate on /terminos stays as the fallback.
// Secondary but readable: fg-secondary on the warm form panel passes AA.
export function SignUpConsentNotice({
  variant,
  id,
}: {
  variant: "register" | "login";
  id: string;
}) {
  const copy = TERMS_COPY.signUpConsent;
  const { terms, privacy } = TERMS_COPY.links;
  return (
    <p
      id={id}
      data-testid="sign-up-consent-notice"
      className="text-balance text-center text-fg-secondary text-xs leading-relaxed"
    >
      {copy[variant]} <TextLink href={terms.href}>{terms.label}</TextLink>
      {copy.afterTerms} <TextLink href={privacy.href}>{privacy.label}</TextLink>
      {copy.end}
    </p>
  );
}
