import type { LucideIcon } from "lucide-react";
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { IconTile } from "@/shared/ui/icon-tile";
import { PopNumber } from "@/shared/ui/pop-number";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { cn } from "@/shared/ui/utils";

// Same colour vocabulary as TechniqueCard/TechniqueTone (Flashcards yellow,
// Recordación activa green, Examen rose), kept local so this atom has no
// dependency on the techniques panel.
export type CountCardTone = "yellow" | "green" | "rose";

// Pastel tile as on the techniques panel; the value and the ring arc use
// the technique's solid 600 shade (≥ 3:1 on white, enough for 26px bold
// text and a non-text indicator).
const TILE_TONE: Record<CountCardTone, "yellow" | "mint" | "pink"> = {
  yellow: "yellow",
  green: "mint",
  rose: "pink",
};

const TONE_TEXT: Record<CountCardTone, string> = {
  yellow: "text-warning-600",
  green: "text-success-600",
  rose: "text-rose-600",
};

// A soft radial glow of the technique's pastel from the icon corner,
// fading to the white card (globals.css technique-glow-*), so the colour
// reads as a hint.
const WASH_CLASS: Record<CountCardTone, string> = {
  yellow: "technique-glow-yellow",
  green: "technique-glow-mint",
  rose: "technique-glow-pink",
};

export interface TechniqueCountCardRing {
  // 0–100 share of the arc.
  percent: number;
  // What sits inside the ring: the percentage, a check (day done) or a
  // dash (nothing to measure).
  center: "percent" | "check" | "dash";
}

export interface TechniqueCountCardProps {
  href: string;
  icon: LucideIcon;
  tone: CountCardTone;
  label: string;
  // The big value: a count ("3"), "Al día", or a short phrase.
  value: string;
  // Muted text after a count, e.g. "de 8"; null or omitted for none.
  valueSuffix?: string | null;
  // "tone": 26px bold in the technique colour (counts, "Al día").
  // "muted": a quieter 17px phrase ("Sin repasos hoy", "—").
  emphasis: "tone" | "muted";
  sub: string;
  ring: TechniqueCountCardRing;
  // Full accessible name of the link, e.g.
  // "Flashcards: 3 de 8 repasos hechos hoy".
  ariaLabel: string;
  // Seconds before the value pops in, to follow the page's stagger.
  delay?: number;
  className?: string;
}

// Technique progress card of the populated Home (Phase 8 H2-T5f): a
// compact link card (~118px): the technique's icon tile, full label and a
// chevron on top; today's value and sub line below, with a small progress
// ring on their right (the label never shares a row with the ring, so it is
// never truncated: user 2026-10-18). The whole card is a link to the technique's
// hub; the ring is decorative (the link's aria-label says it all).
export function TechniqueCountCard({
  href,
  icon: Icon,
  tone,
  label,
  value,
  valueSuffix,
  emphasis,
  sub,
  ring,
  ariaLabel,
  delay,
  className,
}: TechniqueCountCardProps) {
  const toned = emphasis === "tone";
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      data-slot="technique-count-card"
      className={cn(
        "group flex flex-col gap-2.5 rounded-xl border border-border-subtle bg-card px-4 py-3.5 no-underline shadow-xs outline-none transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-default hover:shadow-card-hover focus-visible:ring-3 focus-visible:ring-ring/50",
        WASH_CLASS[tone],
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <IconTile size="30" radius="md" tone={TILE_TONE[tone]}>
          <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
        </IconTile>
        <span className="min-w-0 flex-1 font-medium text-[14px] text-fg leading-tight">
          {label}
        </span>
        <ChevronRight
          aria-hidden="true"
          size={16}
          strokeWidth={1.75}
          className="shrink-0 text-fg-muted transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </span>
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex h-7 min-w-0 items-baseline gap-1">
            <PopNumber
              value={value}
              delay={delay}
              className={cn(
                "truncate leading-none",
                toned
                  ? cn(
                      "font-bold text-[26px] tracking-[-0.02em] tabular-nums",
                      TONE_TEXT[tone],
                    )
                  : "self-center font-semibold text-[17px] text-fg-secondary tracking-[-0.01em]",
              )}
            />
            {valueSuffix ? (
              <span className="whitespace-nowrap font-medium text-[14px] text-fg-secondary tabular-nums">
                {valueSuffix}
              </span>
            ) : null}
          </span>
          <span className="truncate text-[12.5px] text-fg-secondary leading-4">
            {sub}
          </span>
        </span>
        <ProgressRing
          value={ring.percent}
          size={46}
          strokeWidth={4}
          indicatorClassName={TONE_TEXT[tone]}
          className="shrink-0"
        >
          {ring.center === "percent" ? (
            <span className="font-semibold text-[11px] text-fg tabular-nums leading-none">
              {Math.round(ring.percent)}%
            </span>
          ) : ring.center === "check" ? (
            <Check
              aria-hidden="true"
              size={18}
              strokeWidth={2.5}
              className={TONE_TEXT[tone]}
            />
          ) : (
            <span className="text-[13px] text-fg-placeholder leading-none">
              —
            </span>
          )}
        </ProgressRing>
      </span>
    </Link>
  );
}
