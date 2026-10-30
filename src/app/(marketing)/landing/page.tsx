import type { Metadata } from "next";
import { SiteFooter } from "../_components/site-footer";
import { Closing } from "./_components/closing";
import { Comparison } from "./_components/comparison";
import { Faq } from "./_components/faq";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { LandingNav } from "./_components/landing-nav";
import { Pillars } from "./_components/pillars";
import { Techniques } from "./_components/techniques";

export const metadata: Metadata = {
  title: "Cogni · Recuerda lo que estudias",
  description:
    "Cogni convierte tus apuntes en flashcards, exámenes y preguntas de recuperación activa, y te dice qué repasar cada día.",
};

// Public landing (proxy OPEN_PATHS). Sections follow the Pencil frames
// "Landing · Prototipo v1" and "Landing · Contenido propuesto v2" (the
// comparison, the questions, the closing and the footer).
export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        {/* data-nav-theme: the ground under the fixed nav (landing-nav.tsx). */}
        <div data-nav-theme="dark">
          <Hero />
        </div>
        <HowItWorks />
        <Techniques />
        <div data-nav-theme="light">
          <Pillars />
        </div>
        <Comparison />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}
