import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/modules/identity";
import { PageHeader } from "../_components/page-header";
import { SiteFooter } from "../_components/site-footer";
import { HeadlineObject } from "../landing/_components/headline-object";
import { LandingNav } from "../landing/_components/landing-nav";
import { ConceptIndex, ScienceConcepts } from "./_components/science-concepts";

export const metadata: Metadata = {
  title: "La ciencia detrás de Cogni · Cogni",
  description:
    "Seis ideas de la investigación sobre cómo se aprende, qué hace Cogni con cada una y sus fuentes.",
};

// Public page (proxy OPEN_PATHS), Pencil frame "Página · La ciencia detrás
// de Cogni" (docs/landing/propuesta-contenido.md §10.1): a short,
// Brilliant-style read, the lilac head with an index, six ideas and a
// close back into the night. "recordar" is the italic keyword: it is what
// every idea on the page is for.
// A signed-in user may read it too (the proxy only bounces them from /);
// the nav then offers "Ir a la app" instead of the landing section links.
export default async function SciencePage() {
  const signedIn = (await getCurrentUser()) !== null;
  return (
    <>
      <LandingNav signedIn={signedIn} />
      <main>
        <PageHeader
          back
          label="La ciencia detrás de Cogni"
          titleId="ciencia-title"
          title={
            <>
              Seis{" "}
              <span className="whitespace-nowrap">
                ideas <HeadlineObject glyph="notebook" tone="yellow" />
              </span>{" "}
              para <em className="lp-headline-accent">recordar</em> lo que
              estudias.
            </>
          }
          intro="Lo que la investigación sabe sobre cómo se aprende, y qué hace Cogni con cada idea. Sin promesas: con fuentes."
        >
          <ConceptIndex />
        </PageHeader>
        <ScienceConcepts />
        <section
          aria-labelledby="ciencia-cierre-title"
          className="lp-closing relative px-5 pt-[120px] pb-[110px] text-center md:px-10"
        >
          <span
            aria-hidden="true"
            data-nav-theme="light"
            className="absolute inset-x-0 top-0 h-[25%]"
          />
          <span
            aria-hidden="true"
            data-nav-theme="dark"
            className="absolute inset-x-0 bottom-0 h-[75%]"
          />
          <div className="relative mx-auto flex max-w-[1000px] flex-col items-center">
            <h2
              id="ciencia-cierre-title"
              className="lp-headline lp-headline-compact text-white"
            >
              Todo esto, en tus{" "}
              <em className="lp-headline-accent lp-accent-yellow">páginas</em>.
            </h2>
            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="lp-press lp-cta-primary rounded-full px-[30px] py-4 font-(family-name:--lp-font-head) font-semibold text-[17px]"
              >
                Empieza gratis
              </Link>
              <Link
                href="/#como-funciona"
                className="lp-press lp-cta-ghost rounded-full px-[30px] py-4 font-(family-name:--lp-font-head) font-semibold text-[17px]"
              >
                Ver cómo funciona
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
