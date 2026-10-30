import type { Metadata } from "next";
import { PageHeader } from "../_components/page-header";
import { SiteFooter } from "../_components/site-footer";
import { LandingNav } from "../landing/_components/landing-nav";
import { CreditsList } from "./_components/credits-list";

export const metadata: Metadata = {
  title: "Créditos · Cogni",
  description:
    "Los recursos de terceros que usa Cogni, con su autor y su licencia.",
};

// Public page (proxy OPEN_PATHS), Pencil frame "Página · Créditos"
// (docs/landing/propuesta-contenido.md §10.2). "ayuda" is the italic
// keyword: the page thanks the work it is built with.
export default function CreditsPage() {
  return (
    <>
      <LandingNav />
      <main>
        <PageHeader
          label="Créditos"
          titleId="creditos-title"
          title={
            <>
              Hecho con <em className="lp-headline-accent">ayuda</em>.
            </>
          }
          intro="Los recursos de terceros que usa Cogni, con su autor y su licencia."
        />
        <CreditsList />
      </main>
      <SiteFooter />
    </>
  );
}
