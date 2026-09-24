"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

export interface SessionSummaryStat {
  // React key for this cell (e.g. "again", "reforzar").
  key: string;
  label: string;
  value: number | string;
  // The value's own text color class (e.g. "text-error-600").
  toneClassName: string;
}

export interface SessionSummaryAction {
  label: ReactNode;
  // A Link when `href` is set, a plain button otherwise.
  href?: string;
  onClick?: () => void;
}

export interface SessionSummaryProps {
  emoji?: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  // A 3- or 4-cell grid (Active recall/Flashcards); any other length falls
  // back to the 4-column layout.
  stats: SessionSummaryStat[];
  // The "Próxima revisión" (Flashcards) / "Autoevaluación promedio" (Active
  // recall) panel content — the tinted `bg-neutral-100` wrapper stays owned
  // by this atom, only the inner content is per-technique.
  highlight?: ReactNode;
  // Flashcards' original layout is stats → feedback → highlight; Active
  // recall's documento-maestro flow wants stats → highlight → feedback
  // instead (the AI feedback is reserved for the very end). A plain layout
  // switch keeps one component instead of forking it in two.
  highlightBeforeFeedback?: boolean;
  // Slot for the AI session feedback (design/shell-look, user decision
  // 2026-09-24: reserve the place now so the real content can drop in later
  // without touching the layout). Defaults to the "pronto" placeholder
  // panel below.
  feedback?: ReactNode;
  primaryAction: SessionSummaryAction;
  secondaryAction: SessionSummaryAction;
  className?: string;
}

const STATS_GRID_COLS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
};

// Reusable "Retroalimentación de la sesión" tinted placeholder (design/
// shell-look, user decision 2026-09-24): a Sparkles IconTile, the fixed
// title + "pronto" Pill, and a per-technique description. Exported so
// Active recall can reuse the exact same chrome with its own copy instead
// of duplicating the markup.
export function FeedbackPlaceholder({
  description,
}: {
  description: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary-100 bg-primary-50 p-3.5 text-left">
      <IconTile tone="primary" size="30" radius="md" className="mt-0.5">
        <Sparkles aria-hidden="true" size={15} strokeWidth={1.75} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-semibold text-[13px] text-fg">
            Retroalimentación de la sesión
          </p>
          <Pill size="sm" tone="neutral">
            pronto
          </Pill>
        </div>
        <p className="mt-1 text-[12px] text-fg-muted">{description}</p>
      </div>
    </div>
  );
}

const DEFAULT_FEEDBACK = (
  <FeedbackPlaceholder description="Aquí verás qué recordaste bien y qué conviene reforzar." />
);

function renderAction(
  action: SessionSummaryAction,
  variant: "outline" | "default",
  className: string,
) {
  if (action.href) {
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

// Session-complete panel (studyplatform-flashcards-style.md §3 summary
// modal; generalized 2026-09-24 for Active recall's documento-maestro §3.3
// flow — see each prop's docs above). A plain fixed overlay rather than
// Cogni's Radix `Dialog` (`dialog.tsx`): `DialogContent` always renders its
// own hardcoded `DialogOverlay` (light `bg-black/10`, no blur) with no way
// for a caller to reach the darker/blurred overlay or the 520px panel width
// the mockups call for without editing that shared atom, which was out of
// scope for this pass — the task's own fallback clause covers this case.
export function SessionSummary({
  emoji = "🎉",
  title,
  subtitle,
  stats,
  highlight,
  highlightBeforeFeedback = false,
  feedback = DEFAULT_FEEDBACK,
  primaryAction,
  secondaryAction,
  className,
}: SessionSummaryProps) {
  const highlightPanel = highlight && (
    <div className="mt-4 rounded-lg bg-neutral-100 px-4 py-3.5">
      {highlight}
    </div>
  );
  const feedbackPanel = feedback && <div className="mt-4">{feedback}</div>;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/[45%] p-4 backdrop-blur-sm"
    >
      <div
        className={cn(
          "max-h-[calc(100dvh-32px)] w-full max-w-[520px] overflow-y-auto rounded-3xl bg-card p-8 text-center shadow-card-hover",
          className,
        )}
      >
        <p aria-hidden="true" className="mb-3 text-[32px] leading-none">
          {emoji}
        </p>
        <h2
          id="session-summary-title"
          className="font-bold text-[22px] text-fg"
        >
          {title}
        </h2>
        <p className="mt-1.5 text-[13px] text-fg-muted">{subtitle}</p>

        <div
          className={cn(
            "mt-6 grid gap-2.5",
            STATS_GRID_COLS[stats.length] ?? "grid-cols-4",
          )}
        >
          {stats.map((stat) => (
            <div
              key={stat.key}
              className="rounded-lg bg-neutral-100 px-2 py-3.5"
            >
              <p className={cn("font-bold text-[22px]", stat.toneClassName)}>
                {stat.value}
              </p>
              <p className="mt-0.5 text-[11px] text-fg-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        {highlightBeforeFeedback ? (
          <>
            {highlightPanel}
            {feedbackPanel}
          </>
        ) : (
          <>
            {feedbackPanel}
            {highlightPanel}
          </>
        )}

        <div className="mt-6 flex items-center gap-2.5">
          {renderAction(secondaryAction, "outline", "flex-1")}
          {renderAction(primaryAction, "default", "flex-[2]")}
        </div>
      </div>
    </div>
  );
}
