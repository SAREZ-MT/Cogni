import { TextLink } from "@/shared/ui/text-link";
import { TERMS_COPY } from "./terms-copy";

// One-line reminder under the sign-in and sign-up forms. Acceptance itself
// happens after sign-in (the (app) gate), so Google sign-ups are covered too.
// Secondary but readable: fg-secondary on the warm form panel passes AA.
export function TermsNotice() {
  return (
    <p className="text-balance text-center text-fg-secondary text-xs leading-relaxed">
      {TERMS_COPY.links.notice}{" "}
      <TextLink href="/terminos">{TERMS_COPY.links.link}</TextLink>.
    </p>
  );
}
