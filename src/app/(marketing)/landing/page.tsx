import type { Metadata } from "next";
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

// Public landing (proxy OPEN_PATHS). Sections follow the Pencil frame
// "Landing · Prototipo v1"; the empty ones are filled by later tasks and
// exist now so the nav anchors resolve.
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
        {/* T3: science, curve, comparison, receipt, FAQ, closing, footer. */}
        <section id="ciencia" data-nav-theme="light" className="scroll-mt-20" />
        <section
          id="preguntas"
          data-nav-theme="light"
          className="scroll-mt-20"
        />
      </main>
    </>
  );
}
