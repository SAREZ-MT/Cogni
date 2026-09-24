"use client";

import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";

export interface SessionSummaryStats {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

const STAT_ORDER: {
  key: keyof SessionSummaryStats;
  label: string;
  toneClassName: string;
}[] = [
  { key: "again", label: "Otra vez", toneClassName: "text-error-600" },
  { key: "hard", label: "Difícil", toneClassName: "text-warning-600" },
  { key: "good", label: "Bien", toneClassName: "text-success-600" },
  { key: "easy", label: "Fácil", toneClassName: "text-primary-600" },
];

export interface SessionSummaryProps {
  deckLabel: string;
  reviewedCount: number;
  nextReviewCount: number;
  stats: SessionSummaryStats;
  backHref: string;
  onRestart: () => void;
  className?: string;
}

// Session-complete panel (studyplatform-flashcards-style.md §3 summary
// modal). A plain fixed overlay rather than Cogni's Radix `Dialog`
// (`dialog.tsx`): `DialogContent` always renders its own hardcoded
// `DialogOverlay` (light `bg-black/10`, no blur) with no way for a caller
// to reach the darker/blurred overlay or the 520px panel width the
// mockups call for without editing that shared atom, which was out of
// scope for this pass — the task's own fallback clause covers this case.
export function SessionSummary({
  deckLabel,
  reviewedCount,
  nextReviewCount,
  stats,
  backHref,
  onRestart,
  className,
}: SessionSummaryProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/[45%] p-4 backdrop-blur-sm"
    >
      <div
        className={cn(
          "w-full max-w-[520px] rounded-3xl bg-card p-8 text-center shadow-card-hover",
          className,
        )}
      >
        <p aria-hidden="true" className="mb-3 text-[32px] leading-none">
          🎉
        </p>
        <h2
          id="session-summary-title"
          className="font-bold text-[22px] text-fg"
        >
          ¡Sesión completada!
        </h2>
        <p className="mt-1.5 text-[13px] text-fg-muted">
          {deckLabel} — {reviewedCount} tarjetas revisadas
        </p>

        <div className="mt-6 grid grid-cols-4 gap-2.5">
          {STAT_ORDER.map(({ key, label, toneClassName }) => (
            <div key={key} className="rounded-lg bg-neutral-100 px-2 py-3.5">
              <p className={cn("font-bold text-[22px]", toneClassName)}>
                {stats[key]}
              </p>
              <p className="mt-0.5 text-[11px] text-fg-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-neutral-100 px-4 py-3.5">
          <p className="text-[13px] text-fg-muted">Próxima revisión</p>
          <p className="mt-0.5 font-semibold text-[15px] text-fg">
            Mañana · {nextReviewCount} tarjetas programadas
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2.5">
          <Button asChild variant="outline" className="flex-1">
            <Link href={backHref}>Volver al mazo</Link>
          </Button>
          <Button type="button" className="flex-[2]" onClick={onRestart}>
            Repasar de nuevo →
          </Button>
        </div>
      </div>
    </div>
  );
}
