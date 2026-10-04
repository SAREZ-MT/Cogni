import { TERMS_VERSION } from "../domain";
import { TERMS_COPY } from "./terms-copy";

// Read-only terms text. Server component: no state, safe for anonymous
// visitors (the /terminos page shows it before and after sign-in).
export function TermsOfUse() {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl text-fg">{TERMS_COPY.title}</h1>
        <p className="text-fg-muted text-xs">
          {TERMS_COPY.versionLabel(TERMS_VERSION)}
        </p>
        <p className="text-fg-secondary text-sm">{TERMS_COPY.intro}</p>
      </header>
      {TERMS_COPY.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-1">
          <h2 className="font-semibold text-base text-fg">{section.title}</h2>
          <p className="text-fg-secondary text-sm">{section.body}</p>
        </section>
      ))}
    </article>
  );
}
