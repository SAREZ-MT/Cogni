"use client";

import { cn } from "@/shared/ui/utils";

export interface ChoiceGroupOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface ChoiceGroupProps<T extends string> {
  options: readonly ChoiceGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  // Tags each option as `${testId}-${value}`.
  testId?: string;
  // The checked row's accent: "rose" (default, exams) or "amber" (Phase 8
  // H11, the flashcards create dialog).
  tone?: "rose" | "amber";
  className?: string;
}

const CHECKED: Record<NonNullable<ChoiceGroupProps<string>["tone"]>, string> = {
  rose: "border-rose-500 bg-pastel-pink/30",
  amber: "border-warning-500 bg-pastel-yellow/40",
};

// A small single-choice list of bordered rows (radio semantics), styled
// like OptionRow's default/selected states (rose border + pastel-pink tint
// when checked). First used by "Crear examen" to pick how the exam is
// created ("Generar con IA" / "Crear mis preguntas").
export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  testId,
  tone = "rose",
  className,
}: ChoiceGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-2", className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a bordered row with a description reads better than a styled native radio
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            data-testid={testId ? `${testId}-${option.value}` : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex w-full flex-col items-start rounded-xl border-[1.5px] px-3.5 py-2.5 text-left transition-colors duration-150",
              checked
                ? CHECKED[tone]
                : "border-neutral-200/80 bg-card hover:border-neutral-300",
            )}
          >
            <span className="font-medium text-[13px] text-fg">
              {option.label}
            </span>
            {option.description && (
              <span className="text-[11.5px] text-fg-muted">
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
