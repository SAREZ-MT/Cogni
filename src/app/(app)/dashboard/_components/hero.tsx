import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import type { HeroView } from "../_lib/dashboard-view";

// Hidden, not removed (user decision 2026-11-26). Set a flag to true to
// bring its piece back:
// - the "Ver repasos de hoy" button;
// - the sentence about the weakest notebook and the hour-based greeting
//   (`hero.subtitle`, `hero.greeting`), which the view still builds.
const SHOW_REVIEW_CTA: boolean = false;
const SHOW_NOTEBOOK_HINT: boolean = false;

const WELCOME = "Qué gusto volver a verte por acá";
const MESSAGE =
  "Tu esfuerzo se nota semana a semana. Revisa tus métricas, descubre qué temas ya dominas y cuáles te conviene repasar.";

// The welcome tour's illustration, reused (user decision 2026-11-26): the
// tour is seen once, and this card is always on screen. Decorative. Its
// background is white, so it blends into the card's gradient
// (`mix-blend-multiply`, like the Home hero's illustration).
const ILLUSTRATION = {
  src: "/illustrations/tour-welcome.webp",
  width: 880,
  height: 609,
} as const;

// Row 1 (wide) — hero: a welcome by account name in the handwritten face
// (Caveat, the one of the active recall empty state), a line on what the
// page is for and the illustration.
export function DashboardHero({ hero }: { hero: HeroView }) {
  return (
    <Card
      data-testid="hero"
      padding="lg"
      tone="achievement"
      className="flex items-center justify-between gap-6 overflow-hidden"
    >
      <div className="flex flex-col items-start gap-4">
        <div>
          {SHOW_NOTEBOOK_HINT ? (
            <h1 className="font-bold text-[22px] text-fg">{hero.greeting}</h1>
          ) : (
            <h1 className="font-[family-name:var(--font-handwriting)] font-medium text-[38px] text-fg leading-[1.05]">
              {WELCOME}
              {hero.name && (
                <>
                  , <span className="text-gradient-brand">{hero.name}</span>
                </>
              )}
            </h1>
          )}
          <p className="mt-2.5 max-w-md text-[13.5px] text-fg-secondary leading-[1.55]">
            {SHOW_NOTEBOOK_HINT ? hero.subtitle : MESSAGE}
          </p>
        </div>
        {SHOW_REVIEW_CTA && (
          <Button asChild>
            <Link href="/inicio">
              Ver repasos de hoy
              <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
            </Link>
          </Button>
        )}
      </div>
      <Image
        src={ILLUSTRATION.src}
        alt=""
        width={ILLUSTRATION.width}
        height={ILLUSTRATION.height}
        sizes="230px"
        className="dash-float -my-2 hidden h-auto w-[226px] shrink-0 mix-blend-multiply sm:block"
      />
    </Card>
  );
}
