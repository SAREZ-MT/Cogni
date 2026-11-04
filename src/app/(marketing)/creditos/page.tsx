import type { Metadata } from "next";
import { shareMetadata } from "@/app/_lib/share-metadata";
import { getCurrentUser } from "@/modules/identity";
import { PageHeader } from "../_components/page-header";
import { SiteFooter } from "../_components/site-footer";
import { LandingNav } from "../landing/_components/landing-nav";
import { CreditsList } from "./_components/credits-list";

const TITLE = "Créditos · Cogni";
const DESCRIPTION =
  "Los recursos de terceros que usa Cogni, con su autor y su licencia.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...shareMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: "/creditos",
  }),
};

// Public page (proxy OPEN_PATHS), Pencil frame "Página · Créditos"
// (docs/landing/propuesta-contenido.md §10.2). "ayuda" is the italic
// keyword: the page thanks the work it is built with.
// A signed-in user may read it too (the proxy only bounces them from /);
// the nav and the footer then point to the app (/inicio) instead of the
// landing.
export default async function CreditsPage() {
  const signedIn = (await getCurrentUser()) !== null;
  return (
    <>
      <LandingNav signedIn={signedIn} />
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
      <SiteFooter signedIn={signedIn} />
    </>
  );
}
