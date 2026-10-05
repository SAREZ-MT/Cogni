import { Minus, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";

export interface CountStepperProps {
  // Visible label; also names the group and the two buttons ("Más
  // preguntas" / "Menos preguntas" for "Preguntas").
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  // Tags the value as `${testId}-value`.
  testId?: string;
  className?: string;
}

// Compact numeric choice inside a fixed range (Phase 5: how many exam
// questions to generate, 10-30): label on the left, − value + on the
// right, both buttons clamp to [min, max] and disable at the bounds. Small
// enough for the 264px techniques panel.
export function CountStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  testId,
  className,
}: CountStepperProps) {
  const noun = label.toLocaleLowerCase();
  const change = (delta: number) =>
    onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend styling; role="group" labels the two buttons and the value
    <div
      role="group"
      aria-label={label}
      className={cn("flex items-center justify-between gap-2", className)}
    >
      <span className="text-[10.5px] text-fg-muted">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={`Menos ${noun}`}
          disabled={disabled || value <= min}
          onClick={() => change(-step)}
        >
          <Minus aria-hidden="true" strokeWidth={2} />
        </Button>
        <output
          aria-live="polite"
          data-testid={testId ? `${testId}-value` : undefined}
          className="min-w-6 text-center font-semibold text-fg text-xs tabular-nums"
        >
          {value}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={`Más ${noun}`}
          disabled={disabled || value >= max}
          onClick={() => change(step)}
        >
          <Plus aria-hidden="true" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
