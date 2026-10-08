import Link from "next/link";
import { Pill } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

function masteryToneClassName(mastery: number): string {
  if (mastery >= 70) return "text-success-600";
  if (mastery >= 40) return "text-warning-600";
  return "text-error-600";
}

export interface RecallPageCardProps {
  // The latest session's results route (Phase 6 T7).
  href: string;
  notebookTitle: string;
  pageTitle: string;
  // Preformatted (e.g. "24 sept") — sample data owns formatting, same
  // pattern as flashcards/_data/sample.ts's saved-study-item rows.
  lastSessionDate: string;
  questionCount: number;
  sessionCount: number;
  // Most recent session's "dominio" (combined quality, documento-maestro
  // §7.4), 0-100 — renamed from "accuracy" (design/shell-look fix
  // 2026-09-24) so the metric name matches what it measures.
  mastery: number;
  // Derived from the AI score buckets (≥4 aiCorrect, 2-3 aiPartial, ≤1
  // aiIncorrect), never the self-rating bucket.
  aiCorrect: number;
  aiPartial: number;
  aiIncorrect: number;
  className?: string;
}

// Active recall's "Sesiones por página" grid item (design preview,
// studyplatform-active-recall-style.md hub SessionCard, adapted to the
// notebook-detail route instead — see active-recall/[notebookId]/page.tsx):
// a tinted success header (notebook name + page title), a body with the
// last session date and a preguntas/sesiones meta line, and a footer with
// the latest accuracy (tone by threshold) + its correct/partial/incorrect
// breakdown, plus a "Ver resultados →" pill: the card opens the latest
// session's results (user decision 2026-10-08, Phase 6 T7; was "Repasar →").
export function RecallPageCard({
  href,
  notebookTitle,
  pageTitle,
  lastSessionDate,
  questionCount,
  sessionCount,
  mastery,
  aiCorrect,
  aiPartial,
  aiIncorrect,
  className,
}: RecallPageCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "block overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      <div className="bg-success-100/35 px-4 pt-3.5 pb-3">
        <p className="font-medium text-[11px] text-success-600">
          {notebookTitle}
        </p>
        <p className="mt-0.5 truncate font-semibold text-[15px] text-fg">
          {pageTitle}
        </p>
      </div>
      <div className="px-4 pt-3 pb-4">
        <p className="font-medium text-fg-muted text-xs">{lastSessionDate}</p>
        <p className="mt-0.5 text-fg-muted text-xs">
          {questionCount} preguntas · {sessionCount}{" "}
          {sessionCount === 1 ? "sesión" : "sesiones"}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p
              className={cn(
                "font-bold text-[22px] leading-none",
                masteryToneClassName(mastery),
              )}
            >
              {mastery}%
            </p>
            <p className="mt-1 text-[10px] text-fg-muted">
              {aiCorrect}✓ · {aiPartial}~ · {aiIncorrect}✗
            </p>
          </div>
          <Pill size="sm" tone="success">
            Ver resultados →
          </Pill>
        </div>
      </div>
    </Link>
  );
}
