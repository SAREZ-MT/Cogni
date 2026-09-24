import { Button } from "@/shared/ui/button";
import { Pill, type PillProps } from "@/shared/ui/pill";
import { cn } from "@/shared/ui/utils";

export type ExamQuestionRowOrigin = "ai" | "manual" | "ai_variant";

const ORIGIN_CONFIG: Record<
  ExamQuestionRowOrigin,
  { label: string; tone: NonNullable<PillProps["tone"]> }
> = {
  ai: { label: "IA", tone: "primary" },
  manual: { label: "Manual", tone: "success" },
  ai_variant: { label: "Variante", tone: "rose" },
};

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export interface ExamQuestionRowProps {
  // 1-based position within the management list.
  index: number;
  stem: string;
  concept: string;
  origin: ExamQuestionRowOrigin;
  options: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  // Preformatted date — presence marks the row retired (§7.5: a variant
  // replaces a retired original in the question bank, it's never deleted).
  retiredAt?: string;
  onEdit: () => void;
  // Omitted (not just disabled) once the question is already retired —
  // there's nothing left to retire.
  onRetire?: () => void;
  className?: string;
}

// One row in the "Preguntas del examen" manual creation/editing list
// (design preview, 2026-09-24; documento-maestro §3.3 "creadas
// manualmente", Fase 5 "edición manual de preguntas con concept"): index +
// stem, a concept `Pill`, an origin `Pill` (IA/Manual/Variante), a muted
// "Retirada" `Pill` + reduced opacity once retired, an A–D options preview
// line with the correct one bold, and "Editar"/"Retirar" actions.
export function ExamQuestionRow({
  index,
  stem,
  concept,
  origin,
  options,
  correctIndex,
  retiredAt,
  onEdit,
  onRetire,
  className,
}: ExamQuestionRowProps) {
  const originConfig = ORIGIN_CONFIG[origin];

  return (
    <div
      data-testid="exam-question-row"
      className={cn(
        "rounded-2xl border border-border-subtle bg-card p-4",
        retiredAt && "opacity-60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[14px] text-fg leading-[1.5]">
          <span className="font-medium">
            {index}. {stem}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            Editar
          </Button>
          {onRetire && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-fg-muted"
              onClick={onRetire}
            >
              Retirar
            </Button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Pill size="sm" tone="neutral">
          Concepto: {concept}
        </Pill>
        <Pill size="sm" tone={originConfig.tone}>
          {originConfig.label}
        </Pill>
        {retiredAt && (
          <Pill size="sm" tone="muted">
            Retirada
          </Pill>
        )}
      </div>

      <p className="mt-2 text-[12.5px] text-fg-muted leading-[1.6]">
        {options.map((option, optionIndex) => (
          <span key={OPTION_LETTERS[optionIndex]}>
            {optionIndex > 0 && " · "}
            {optionIndex === correctIndex ? (
              <strong className="font-semibold text-fg">
                {OPTION_LETTERS[optionIndex]}) {option}
              </strong>
            ) : (
              `${OPTION_LETTERS[optionIndex]}) ${option}`
            )}
          </span>
        ))}
      </p>
    </div>
  );
}
