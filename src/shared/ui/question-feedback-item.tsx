import { ThumbsDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { FeedbackBlock } from "@/shared/ui/feedback-block";
import { Pill } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

export interface QuestionFeedbackItemProps {
  // 1-based question number within the session.
  index: number;
  question: string;
  // The student's submitted answer, or "(sin respuesta)" for a skipped
  // question (documento-maestro §3.3's "Saltar" flow).
  answer: string;
  selfRating: number;
  // Bucket label/tone for the self-rating pill (design/shell-look fix,
  // 2026-09-24) — caller passes `SELF_RATING_BUCKET_META[bucket]`
  // (active-recall/_components/self-rating.ts) so this atom stays free of
  // the bucketing rule itself.
  selfRatingLabel: string;
  selfRatingTone: "error" | "warning" | "success";
  // Whether this question's AI evaluation is still in flight
  // (documento-maestro §8.5: async evaluation, feedback only shows once
  // every evaluation finishes). Defaults to true since every real session
  // starts pending; the caller flips it once its own evaluation resolves.
  pending?: boolean;
  onDisagree?: () => void;
  className?: string;
}

// Per-question feedback row (design/shell-look fix, 2026-09-24;
// documento-maestro §8.5: "el estudiante ve la justificación y puede marcar
// 'no estoy de acuerdo' (se registra, no cambia el puntaje en v1)"). While
// `pending`, the AI score pill stays "IA — / 5", the justification renders
// as two skeleton lines, and the disagree button is disabled with an
// explanatory `title`.
export function QuestionFeedbackItem({
  index,
  question,
  answer,
  selfRating,
  selfRatingLabel,
  selfRatingTone,
  pending = true,
  onDisagree,
  className,
}: QuestionFeedbackItemProps) {
  return (
    <div
      data-testid="question-feedback-item"
      className={cn(
        "rounded-xl border border-border-subtle bg-card p-5",
        className,
      )}
    >
      <p className="font-semibold text-[14px] text-fg">
        {index}. {question}
      </p>
      <FeedbackBlock eyebrowLabel="Tu respuesta" className="mt-3">
        {answer}
      </FeedbackBlock>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill size="sm" tone={selfRatingTone}>
          Autoevaluación {selfRating} · {selfRatingLabel}
        </Pill>
        <Pill size="sm" tone="neutral">
          IA — / 5
        </Pill>
      </div>
      <div className="mt-3">
        <p className="font-medium text-[11px] text-fg-muted uppercase tracking-[0.05em]">
          Justificación
        </p>
        {pending && (
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="h-3 w-full animate-pulse rounded-full bg-neutral-200 motion-reduce:animate-none" />
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-neutral-200 motion-reduce:animate-none" />
            <p className="mt-1.5 text-[12px] text-fg-muted">
              Disponible cuando termine la evaluación
            </p>
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={pending}
        title={pending ? "Disponible cuando termine la evaluación" : undefined}
        onClick={onDisagree}
      >
        <ThumbsDown aria-hidden="true" size={14} strokeWidth={1.75} />
        No estoy de acuerdo
      </Button>
    </div>
  );
}
