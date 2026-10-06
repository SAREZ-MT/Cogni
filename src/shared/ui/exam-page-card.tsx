import Link from "next/link";
import { Pill } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

function scoreToneClassName(score: number): string {
  if (score >= 80) return "text-success-600";
  if (score >= 60) return "text-warning-600";
  return "text-error-600";
}

export interface ExamPageCardProps {
  notebookId: string;
  pageId: string;
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
  // Exam questions of the page due today (scheduling's "Repasos de hoy").
  // On an examined page with no pending retake, > 0 shows a "Vence hoy"
  // pill and turns the CTA into "Rendir examen" on the exam route (user
  // decision 2026-10-06). Omitted or 0: no due state.
  dueToday?: number;
  className?: string;
}

// Exams' "Exámenes por página" grid item (design preview,
// studyplatform-exams-style.md ExamCard, adapted onto the notebook-detail
// route instead — see exams/[notebookId]/page.tsx): a rose/pink gradient
// top accent bar, a body with the page title, a preguntas/intentos meta
// line, a score-or-"Sin intentar" row (+ a "Repetir pendiente" pill when
// applicable), the last attempt date, and a CTA that reads the page's exact
// state ("Presentar examen" / "Repetir examen" / "Rendir examen" when
// questions are due today, with a "Vence hoy" pill / "Ver resultados").
//
// Fixed 2026-09-24 (design audit vs documento-maestro §7.5): the card now
// computes its own destination from `notebookId`/`pageId` instead of taking
// a single `href` — a retake-pending page must land on the retake question
// set (`?retake=1`), never the plain session, and a passed page links to
// its stored results instead of re-running the exam. The root is a plain
// `div` (not one big `Link`) so a second "Preguntas (N)" link can sit in
// the footer: the title uses the stretched-link pattern
// (`after:absolute after:inset-0`, same as page-list-row.tsx) to keep the
// whole card clickable, and the footer link opts back into its own
// clickable layer with `relative z-10`.
export function ExamPageCard({
  notebookId,
  pageId,
  pageTitle,
  questionCount,
  attempts,
  lastScore,
  retakePending,
  lastDate,
  dueToday = 0,
  className,
}: ExamPageCardProps) {
  const sessionHref = `/exams/${notebookId}/${pageId}`;
  // A pending retake and a never-attempted page keep their own state.
  const dueNow = !retakePending && lastScore !== null && dueToday > 0;
  const primaryHref = retakePending
    ? `${sessionHref}?retake=1`
    : lastScore === null || dueNow
      ? sessionHref
      : `${sessionHref}/resultados`;
  const questionsHref = `${sessionHref}/preguntas`;

  const ctaLabel = retakePending
    ? "Repetir examen →"
    : lastScore === null
      ? "Presentar examen →"
      : dueNow
        ? "Rendir examen →"
        : "Ver resultados →";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="h-1 bg-gradient-to-r from-pastel-pink to-rose-500"
      />
      <div className="px-4 pt-3.5 pb-4">
        <Link
          href={primaryHref}
          className="block truncate font-semibold text-[15px] text-fg after:absolute after:inset-0"
        >
          {pageTitle}
        </Link>
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
          {dueNow && (
            <Pill size="sm" tone="pink">
              Vence hoy
            </Pill>
          )}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-fg-muted">{lastDate}</span>
          <span className="shrink-0 font-medium text-[12px] text-pastel-pink-fg">
            {ctaLabel}
          </span>
        </div>
        <Link
          href={questionsHref}
          className="relative z-10 mt-2 inline-block text-[11px] text-fg-muted underline decoration-dotted underline-offset-2 hover:text-fg"
        >
          Preguntas ({questionCount})
        </Link>
      </div>
    </div>
  );
}
