import { Check, Minus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Pill } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

export type ExamReviewStatus = "correct" | "incorrect" | "unanswered";

const STATUS_CONFIG: Record<
  ExamReviewStatus,
  {
    tileClassName: string;
    icon: ReactNode;
    labelClassName: string;
    label: string;
  }
> = {
  correct: {
    tileClassName: "bg-success-100 text-success-600",
    icon: <Check aria-hidden="true" size={14} strokeWidth={2.5} />,
    labelClassName: "text-success-600",
    label: "Correcta",
  },
  incorrect: {
    tileClassName: "bg-error-100 text-error-600",
    icon: <X aria-hidden="true" size={14} strokeWidth={2.5} />,
    labelClassName: "text-error-600",
    label: "Incorrecta",
  },
  unanswered: {
    tileClassName: "bg-neutral-150 text-fg-muted",
    icon: <Minus aria-hidden="true" size={14} strokeWidth={2.5} />,
    labelClassName: "text-fg-muted",
    label: "Sin responder",
  },
};

export interface ExamReviewRowProps {
  // 1-based question number within the session.
  index: number;
  stem: string;
  status: ExamReviewStatus;
  concept: string;
  // Always shown ("Sin responder" when `status === "unanswered"`).
  yourAnswerLabel: string;
  correctAnswerLabel: string;
  // Whether the AI's per-question explanation is still in flight
  // (documento-maestro §3.3/§7.5: feedback only covers failed questions,
  // generated at the end of the session) — rendered as two skeleton lines,
  // reusing question-feedback-item.tsx's pending pattern. Ignored when
  // `status === "correct"` (a correct answer has no failed-concept
  // explanation to show).
  explanationPending?: boolean;
  // The question's own explanation (Phase 5 T6), shown under "Explicación"
  // for a failed question when no AI explanation is pending. Without it
  // and without a pending explanation, no explanation block renders.
  explanation?: string;
  className?: string;
}

// Exam results' per-question review row (design preview,
// studyplatform-exams-style.md results review: a status tile + stem +
// status label + concept pill, then the student's own answer, the correct
// one (when wrong or unanswered) and a pending AI explanation block).
export function ExamReviewRow({
  index,
  stem,
  status,
  concept,
  yourAnswerLabel,
  correctAnswerLabel,
  explanationPending = true,
  explanation,
  className,
}: ExamReviewRowProps) {
  const config = STATUS_CONFIG[status];
  const isFailed = status !== "correct";

  return (
    <div
      data-testid="exam-review-row"
      className={cn(
        "rounded-2xl border border-border-subtle bg-card p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            config.tileClassName,
          )}
        >
          {config.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[14px] text-fg">
            {index}. {stem}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={cn("font-semibold text-[12px]", config.labelClassName)}
            >
              {config.label}
            </span>
            <Pill size="sm" tone="neutral">
              Concepto: {concept}
            </Pill>
          </div>

          <div className="mt-2 flex flex-col gap-1 text-[13px]">
            <p className="text-fg-muted">Tu respuesta: {yourAnswerLabel}</p>
            {isFailed && (
              <p className="text-success-600">Correcta: {correctAnswerLabel}</p>
            )}
          </div>

          {isFailed && !explanationPending && explanation && (
            <div className="mt-3">
              <p className="font-medium text-[11px] text-fg-muted uppercase tracking-[0.05em]">
                Explicación
              </p>
              <p className="mt-1 text-[13px] text-fg-secondary">
                {explanation}
              </p>
            </div>
          )}

          {isFailed && explanationPending && (
            <div className="mt-3">
              <p className="font-medium text-[11px] text-fg-muted uppercase tracking-[0.05em]">
                Explicación de la IA
              </p>
              {explanationPending && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="h-3 w-full animate-pulse rounded-full bg-neutral-200 motion-reduce:animate-none" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-neutral-200 motion-reduce:animate-none" />
                  <p className="mt-1.5 text-[12px] text-fg-muted">
                    Disponible cuando termine la retroalimentación
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
