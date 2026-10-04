import Link from "next/link";
import { TERMS_COPY } from "./terms-copy";

// One-line reminder under the sign-in and sign-up forms. Acceptance itself
// happens after sign-in (the (app) gate), so Google sign-ups are covered too.
export function TermsNotice() {
  return (
    <p className="text-center text-fg-muted text-xs">
      {TERMS_COPY.links.notice}{" "}
      <Link href="/terminos">{TERMS_COPY.links.link}</Link>.
    </p>
  );
}
