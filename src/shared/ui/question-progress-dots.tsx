import { cn } from "@/shared/ui/utils";

export interface QuestionProgressDotsProps {
  total: number;
  // 0-based index of the question currently on screen.
  current: number;
  // 0-based indices of every already-answered question.
  answered: ReadonlySet<number>;
  onJump: (index: number) => void;
  className?: string;
}

// Exam session's clickable question tracker (design preview,
// studyplatform-exams-style.md player header: a row of 24×6 pills — current
// rose-500, answered pastel-pink-fg, unanswered neutral-200/60 — each one
// jumping straight to that question).
export function QuestionProgressDots({
  total,
  current,
  answered,
  onJump,
  className,
}: QuestionProgressDotsProps) {
  return (
    <div
      data-testid="exam-progress-dots"
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {Array.from({ length: total }, (_, index) => {
        const isCurrent = index === current;
        const isAnswered = answered.has(index);
        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, never-reordered 0..total-1 sequence — the index is the question number.
            key={index}
            type="button"
            onClick={() => onJump(index)}
            aria-label={`Ir a la pregunta ${index + 1}`}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "h-1.5 w-6 rounded-pill transition-colors duration-150",
              isCurrent
                ? "bg-rose-500"
                : isAnswered
                  ? "bg-pastel-pink-fg"
                  : "bg-neutral-200/60",
            )}
          />
        );
      })}
    </div>
  );
}
