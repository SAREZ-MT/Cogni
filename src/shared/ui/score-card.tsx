import { cn } from "@/shared/ui/utils";

function scoreBandClassName(score: number): string {
  if (score >= 80) return "bg-success-100 text-success-600";
  if (score >= 60) return "bg-warning-100 text-warning-600";
  return "bg-error-100 text-error-600";
}

function scoreTitle(score: number): string {
  if (score >= 90) return "¡Excelente!";
  if (score >= 70) return "¡Buen trabajo!";
  if (score >= 50) return "Puedes mejorar";
  return "Sigue practicando";
}

export interface ScoreCardProps {
  score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  // Preformatted "MM:SS".
  timeLabel: string;
  pageTitle: string;
  notebookTitle: string;
  className?: string;
}

// Exam results' headline card (design preview, studyplatform-exams-style.md
// results score card): a tinted disc with the score + correct/total, and a
// band title + stats row (correctas/incorrectas/sin responder/tiempo) on
// the right.
export function ScoreCard({
  score,
  correct,
  incorrect,
  unanswered,
  total,
  timeLabel,
  pageTitle,
  notebookTitle,
  className,
}: ScoreCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-border-subtle bg-card p-7 shadow-md sm:flex-row sm:items-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-[100px] shrink-0 flex-col items-center justify-center rounded-full",
          scoreBandClassName(score),
        )}
      >
        <p
          data-testid="exam-score"
          className="font-extrabold text-[32px] leading-none"
        >
          {score}%
        </p>
        <p className="mt-1 font-medium text-[12px] opacity-80">
          {correct} / {total}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[22px] text-fg">{scoreTitle(score)}</p>
        <p className="mt-1 text-[13px] text-fg-muted">
          {pageTitle} · {notebookTitle}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-secondary">
          <span>
            <strong className="font-semibold text-fg">{correct}</strong>{" "}
            correctas
          </span>
          <span>
            <strong className="font-semibold text-fg">{incorrect}</strong>{" "}
            incorrectas
          </span>
          <span>
            <strong className="font-semibold text-fg">{unanswered}</strong> sin
            responder
          </span>
          <span>
            Tiempo{" "}
            <strong className="font-semibold text-fg">{timeLabel}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
