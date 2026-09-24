import { Clock } from "lucide-react";
import { cn } from "@/shared/ui/utils";

export interface TimerChipProps {
  // Elapsed seconds — owned by the caller (ExamPlayer ticks it with its own
  // interval) so the value survives into the results view's "Tiempo"
  // stat instead of living inside this presentational atom.
  seconds: number;
  className?: string;
}

function formatSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(clamped / 60)).padStart(2, "0");
  const seconds = String(clamped % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// Exam session's count-up timer chip (design preview,
// studyplatform-exams-style.md player header: white, bordered, `Clock` +
// MM:SS). Presentational only — no interval of its own.
export function TimerChip({ seconds, className }: TimerChipProps) {
  return (
    <span
      data-testid="exam-timer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[10px] border border-border-subtle bg-card px-3.5 py-2 font-semibold text-[13px] text-fg-secondary",
        className,
      )}
    >
      <Clock
        aria-hidden="true"
        size={14}
        strokeWidth={1.75}
        className="text-fg-muted"
      />
      {formatSeconds(seconds)}
    </span>
  );
}
