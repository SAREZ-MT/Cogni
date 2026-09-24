import { cn } from "@/shared/ui/utils";

// documento-maestro §3.3 self-evaluation scale: 0 (imposible) to 5 (trivial),
// grading error → warning → success — the same tinted-button look
// `RatingButton` uses for its own tone pairs.
const OPTIONS: { value: number; label: string; toneClassName: string }[] = [
  {
    value: 0,
    label: "Imposible",
    toneClassName:
      "border-error-500/30 bg-error-50/90 text-error-600 hover:bg-error-100/95",
  },
  {
    value: 1,
    label: "Muy difícil",
    toneClassName:
      "border-error-500/30 bg-error-50/90 text-error-600 hover:bg-error-100/95",
  },
  {
    value: 2,
    label: "Difícil",
    toneClassName:
      "border-warning-500/30 bg-warning-50/90 text-warning-600 hover:bg-warning-100/95",
  },
  {
    value: 3,
    label: "Regular",
    toneClassName:
      "border-warning-500/30 bg-warning-50/90 text-warning-600 hover:bg-warning-100/95",
  },
  {
    value: 4,
    label: "Fácil",
    toneClassName:
      "border-success-500/30 bg-success-50/90 text-success-600 hover:bg-success-100/95",
  },
  {
    value: 5,
    label: "Trivial",
    toneClassName:
      "border-success-500/30 bg-success-50/90 text-success-600 hover:bg-success-100/95",
  },
];

export interface DifficultyScaleProps {
  onSelect: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

// Active recall's post-answer self-evaluation (design preview, documento-
// maestro §3.3 "¿Qué tan difícil te resultó?"): 6 equal tinted buttons in a
// responsive grid (3 columns on narrow, 6 once there's room). Tapping an
// option both records the self-rating and advances to the next question —
// there is no separate "Siguiente" action. `data-testid="self-rate-{n}"`.
export function DifficultyScale({
  onSelect,
  disabled,
  className,
}: DifficultyScaleProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2.5", className)}>
      <p className="text-center font-semibold text-[13px] text-fg">
        ¿Qué tan difícil te resultó?
      </p>
      <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={`self-rate-${option.value}`}
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border-[1.5px] px-2 py-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover disabled:pointer-events-none disabled:opacity-50",
              option.toneClassName,
            )}
          >
            <span className="font-bold text-[15px]">{option.value}</span>
            <span className="font-medium text-[11px]">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
