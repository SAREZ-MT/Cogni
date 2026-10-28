import type { Metadata } from "next";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { LandingNav } from "./_components/landing-nav";

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
        <Hero />
        <HowItWorks />
        {/* T2: techniques tabs and pillars 01–05. */}
        <section id="tecnicas" className="scroll-mt-20" />
        {/* T3: science, curve, comparison, receipt, FAQ, closing, footer. */}
        <section id="ciencia" className="scroll-mt-20" />
        <section id="preguntas" className="scroll-mt-20" />
      </main>
    </>
  );
}
