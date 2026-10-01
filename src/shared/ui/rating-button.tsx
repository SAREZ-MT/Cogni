import { cn } from "@/shared/ui/utils";

export type RatingTone = "again" | "hard" | "good" | "easy";

// Tinted bg/border per recall-quality tone (studyplatform-flashcards-
// style.md §3 rating table), translated to Cogni's own error/warning/
// success/primary token pairs — "easy" (violet) sits one step darker
// (primary-100/200 instead of -50/-100) because that's the exact pair the
// report itself uses for that tone.
const TONE_CLASSES: Record<RatingTone, string> = {
  again:
    "border-error-500/30 bg-error-50/90 text-error-600 hover:bg-error-100/95",
  hard: "border-warning-500/30 bg-warning-50/90 text-warning-600 hover:bg-warning-100/95",
  good: "border-success-500/30 bg-success-50/90 text-success-600 hover:bg-success-100/95",
  easy: "border-primary-600/30 bg-primary-100/90 text-primary-600 hover:bg-primary-200/95",
};

export interface RatingButtonProps {
  tone: RatingTone;
  label: string;
  hint: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Session rating control (studyplatform-flashcards-style.md §3 action
// area): one of 4 equal-flex tinted buttons, a -2px hover lift + shadow.
// `data-testid="rate-{tone}"` per the Flashcards design-preview spec.
export function RatingButton({
  tone,
  label,
  hint,
  onClick,
  disabled,
  className,
}: RatingButtonProps) {
  return (
    <button
      type="button"
      data-testid={`rate-${tone}`}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-lg border-[1.5px] px-2 py-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover disabled:pointer-events-none disabled:opacity-50",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="font-semibold text-[13px]">{label}</span>
      <span className="text-[11px] opacity-75">{hint}</span>
    </button>
  );
}
