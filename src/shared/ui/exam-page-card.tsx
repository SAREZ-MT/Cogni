import Link from "next/link";
import { Pill } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

function scoreToneClassName(score: number): string {
  if (score >= 80) return "text-success-600";
  if (score >= 60) return "text-warning-600";
  return "text-error-600";
}

export interface ExamPageCardProps {
  href: string;
  pageTitle: string;
  questionCount: number;
  attempts: number;
  // `null` renders the "Sin intentar" pill instead of a score (a page can
  // have generated questions with zero attempts — documento-maestro §3.3,
  // exams design preview 2026-09-24: unlike Active recall, a page appears
  // in the technique screens once it has generated material, independent
  // of whether it has been attempted).
  lastScore: number | null;
  // documento-maestro §7.5: score < 70 % marks the page for a mandatory
  // retake — shown as its own pill regardless of the score pill above.
  retakePending: boolean;
  // Preformatted (e.g. "22 sept") — sample data owns formatting, same
  // pattern as the other technique previews' date strings. Omitted (never
  // attempted) renders an empty date slot.
  lastDate?: string;
  className?: string;
}

// Exams' "Exámenes por página" grid item (design preview,
// studyplatform-exams-style.md ExamCard, adapted onto the notebook-detail
// route instead — see exams/[notebookId]/page.tsx): a rose/pink gradient
// top accent bar, a body with the page title, a preguntas/intentos meta
// line, a score-or-"Sin intentar" row (+ a "Repetir pendiente" pill when
// applicable), the last attempt date, and a CTA that reads the page's exact
// state ("Presentar examen" / "Repetir examen" / "Ver resultados").
export function ExamPageCard({
  href,
  pageTitle,
  questionCount,
  attempts,
  lastScore,
  retakePending,
  lastDate,
  className,
}: ExamPageCardProps) {
  const ctaLabel = retakePending
    ? "Repetir examen →"
    : lastScore === null
      ? "Presentar examen →"
      : "Ver resultados →";

  return (
    <Link
      href={href}
      className={cn(
        "block overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="h-1 bg-gradient-to-r from-pastel-pink to-rose-500"
      />
      <div className="px-4 pt-3.5 pb-4">
        <p className="truncate font-semibold text-[15px] text-fg">
          {pageTitle}
        </p>
        <p className="mt-0.5 text-fg-muted text-xs">
          {questionCount} preguntas · {attempts} intento
          {attempts === 1 ? "" : "s"}
        </p>
        <div className="mt-3 flex items-center gap-2">
          {lastScore === null ? (
            <Pill size="sm" tone="pink">
              Sin intentar
            </Pill>
          ) : (
            <span
              className={cn(
                "font-semibold text-[13px]",
                scoreToneClassName(lastScore),
              )}
            >
              {lastScore} %
            </span>
          )}
          {retakePending && (
            <Pill size="sm" tone="pink">
              Repetir pendiente
            </Pill>
          )}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-fg-muted">{lastDate}</span>
          <span className="shrink-0 font-medium text-[12px] text-pastel-pink-fg">
            {ctaLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
