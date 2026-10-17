import { TextLink } from "@/shared/ui/text-link";
import { TERMS_COPY } from "./terms-copy";

// One-line reminder under the sign-in and sign-up forms. Acceptance itself
// happens after sign-in (the (app) gate), so Google sign-ups are covered too.
// The sign-up variant says it plainly: the terms come right after sign-up.
// Secondary but readable: fg-secondary on the warm form panel passes AA.
export function TermsNotice({
  variant = "sign-in",
}: {
  variant?: "sign-in" | "sign-up";
}) {
  const { links } = TERMS_COPY;
  if (variant === "sign-up") {
    return (
      <p className="text-balance text-center text-fg-secondary text-xs leading-relaxed">
        {links.signUpNotice} <TextLink href="/terminos">{links.link}</TextLink>{" "}
        {links.signUpNoticeSuffix}.
      </p>
    );
  }
  return (
    <p className="text-balance text-center text-fg-secondary text-xs leading-relaxed">
      {links.notice} <TextLink href="/terminos">{links.link}</TextLink>.
    </p>
  );
}
