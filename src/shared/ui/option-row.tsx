import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/utils";

export type OptionRowState =
  | "default"
  | "selected"
  | "correct"
  | "incorrect"
  | "muted";

const STATE_CLASSES: Record<OptionRowState, { row: string; badge: string }> = {
  default: {
    row: "border-neutral-200/80 bg-card hover:border-neutral-300",
    badge: "bg-neutral-200/50 text-fg-secondary",
  },
  selected: {
    row: "border-rose-500 bg-pastel-pink/30",
    badge: "bg-rose-500 text-white",
  },
  correct: {
    row: "border-success-500 bg-success-50",
    badge: "bg-success-500 text-white",
  },
  incorrect: {
    row: "border-error-500 bg-error-50",
    badge: "bg-error-500 text-white",
  },
  muted: {
    row: "border-neutral-200/60 bg-card opacity-70",
    badge: "bg-neutral-200/50 text-fg-muted",
  },
};

export interface OptionRowProps {
  // 0-based position, used for the `exam-option-{index}` test id — the
  // caller derives the letter from it (A–D) instead of this atom owning the
  // alphabet.
  index: number;
  letter: string;
  text: ReactNode;
  state: OptionRowState;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Exam option button (design preview, studyplatform-exams-style.md player
// options: a letter badge + option text, default/selected while taking —
// never revealing correct/incorrect during the session — and
// correct/incorrect once the results view reuses this atom for its own
// read-only review rows).
export function OptionRow({
  index,
  letter,
  text,
  state,
  onClick,
  disabled,
  className,
}: OptionRowProps) {
  const classes = STATE_CLASSES[state];
  return (
    <button
      type="button"
      data-testid={`exam-option-${index}`}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-xl border-[1.5px] px-[18px] py-[14px] text-left transition-colors duration-150 disabled:cursor-default",
        classes.row,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg font-bold text-xs",
          classes.badge,
        )}
      >
        {state === "correct" ? (
          <Check size={14} strokeWidth={2.5} />
        ) : state === "incorrect" ? (
          <X size={14} strokeWidth={2.5} />
        ) : (
          letter
        )}
      </span>
      <span className="text-[14px] text-fg-secondary leading-[1.5]">
        {text}
      </span>
    </button>
  );
}
