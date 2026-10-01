import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { heroFeedback, SAMPLE_USER_NAME } from "../_data/sample";

// Purely decorative abstract composition (violet pastel shapes, no emoji) —
// a soft nod to "progreso"/growth instead of a literal illustration.
function HeroIllustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 140"
      className="hidden h-[120px] w-[140px] shrink-0 sm:block"
    >
      <circle cx="112" cy="46" r="40" className="fill-primary-100" />
      <circle cx="72" cy="92" r="30" className="fill-primary-200" />
      <rect
        x="24"
        y="70"
        width="44"
        height="44"
        rx="12"
        className="fill-primary-50"
      />
      <path
        d="M40 100 L58 78 L76 92 L100 58"
        stroke="var(--color-primary-500)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="100" cy="58" r="5" className="fill-primary-600" />
    </svg>
  );
}

// Row 1 (wide) — hero: greeting + a feedback sentence derived from the same
// numbers the rest of the page shows, a primary CTA to today's reviews and
// a decorative illustration.
export function DashboardHero() {
  const { deltaPts, weakestNotebookTitle, weakestLevelLabel } = heroFeedback();
  const subtitle =
    deltaPts > 0
      ? `Subiste ${deltaPts} puntos de dominio esta semana. ${weakestNotebookTitle} sigue en ${weakestLevelLabel}: dedícale dos repasos.`
      : `${weakestNotebookTitle} sigue en ${weakestLevelLabel}: dedícale dos repasos para retomar impulso.`;

  return (
    <Card
      data-testid="hero"
      padding="lg"
      className="flex items-center justify-between gap-6"
    >
      <div className="flex flex-col items-start gap-4">
        <div>
          <h1 className="font-bold text-[22px] text-fg">
            Buenos días, {SAMPLE_USER_NAME}
          </h1>
          <p className="mt-1.5 max-w-md text-[13px] text-fg-muted">
            {subtitle}
          </p>
        </div>
        <Button asChild>
          <Link href="/">
            Ver repasos de hoy
            <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        </Button>
      </div>
      <HeroIllustration />
    </Card>
  );
}
