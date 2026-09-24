import Link from "next/link";
import { Pill } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

function accuracyToneClassName(accuracy: number): string {
  if (accuracy >= 70) return "text-success-600";
  if (accuracy >= 40) return "text-warning-600";
  return "text-error-600";
}

export interface RecallPageCardProps {
  href: string;
  notebookTitle: string;
  pageTitle: string;
  // Preformatted (e.g. "24 sept") — sample data owns formatting, same
  // pattern as flashcards/_data/sample.ts's saved-study-item rows.
  lastSessionDate: string;
  questionCount: number;
  sessionCount: number;
  // Most recent session's accuracy (0-100).
  accuracy: number;
  correct: number;
  partial: number;
  incorrect: number;
  className?: string;
}

// Active recall's "Sesiones por página" grid item (design preview,
// studyplatform-active-recall-style.md hub SessionCard, adapted to the
// notebook-detail route instead — see active-recall/[notebookId]/page.tsx):
// a tinted success header (notebook name + page title), a body with the
// last session date and a preguntas/sesiones meta line, and a footer with
// the latest accuracy (tone by threshold) + its correct/partial/incorrect
// breakdown, plus a "Repasar →" pill.
export function RecallPageCard({
  href,
  notebookTitle,
  pageTitle,
  lastSessionDate,
  questionCount,
  sessionCount,
  accuracy,
  correct,
  partial,
  incorrect,
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
          {questionCount} preguntas · {sessionCount} sesiones
        </p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p
              className={cn(
                "font-bold text-[22px] leading-none",
                accuracyToneClassName(accuracy),
              )}
            >
              {accuracy}%
            </p>
            <p className="mt-1 text-[10px] text-fg-muted">
              {correct}✓ · {partial}~ · {incorrect}✗
            </p>
          </div>
          <Pill size="sm" tone="success">
            Repasar →
          </Pill>
        </div>
      </div>
    </Link>
  );
}
