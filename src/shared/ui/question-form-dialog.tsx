"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { FieldLabel } from "@/shared/ui/field-label";
import { FormMessage } from "@/shared/ui/form-message";
import { Input } from "@/shared/ui/input";
import { PixelTile } from "@/shared/ui/pixel-tile";
import { TECHNIQUE_THEME } from "@/shared/ui/technique-theme";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/ui/utils";

export interface QuestionFormValues {
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  concept: string;
  explanation: string;
}

const EMPTY_VALUES: QuestionFormValues = {
  stem: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  concept: "",
  explanation: "",
};

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The question being edited. Questions are created by AI only (Phase 8
  // H13, user 2026-10-29), so the dialog only edits; while no question is
  // chosen (the dialog is closed) the form falls back to empty values.
  initialValues?: QuestionFormValues;
  // A sync handler closes the dialog at once. An async one keeps it open
  // while it runs ("Guardando…"); resolving to a message shows it as an
  // alert and keeps the dialog open, resolving to null/undefined closes it.
  // While it runs the dialog cannot be cancelled or dismissed; a save that
  // resolves after the caller closed (and maybe reopened) the dialog is
  // ignored, so it never closes or annotates a later session.
  onSubmit: (
    values: QuestionFormValues,
  ) => undefined | Promise<string | null | undefined>;
}

// Question editing dialog (design preview, 2026-09-24; documento-maestro
// Fase 5 "edición manual de preguntas con concept"; edit only since Phase 8
// H13) — built on Cogni's Dialog atom, same composition
// pattern as modules/notebooks/ui/create-notebook-dialog.tsx. The caller
// (exam-questions-view.tsx) persists the values through a Server Action;
// this atom collects and validates them and shows the caller's error.
export function QuestionFormDialog({
  open,
  onOpenChange,
  initialValues,
  onSubmit,
}: QuestionFormDialogProps) {
  const [values, setValues] = useState<QuestionFormValues>(
    initialValues ?? EMPTY_VALUES,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Identifies the current open/closed session of the dialog: every `open`
  // transition starts a new one, and a submit only applies its outcome to
  // the session it started in.
  const session = useRef(0);
  const stemId = useId();
  const conceptId = useId();
  const explanationId = useId();

  // Re-syncs the form every time the dialog opens (a re-opened "Editar" for
  // a different row uses the same controlled `open` prop) instead of
  // keying/remounting the component.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-sync on the open transition, not on every initialValues identity change while open.
  useEffect(() => {
    session.current += 1;
    setPending(false);
    if (open) {
      setValues(initialValues ?? EMPTY_VALUES);
      setError(null);
    }
  }, [open]);

  const isValid =
    values.stem.trim().length > 0 &&
    values.options.every((option) => option.trim().length > 0) &&
    values.concept.trim().length > 0;

  function updateOption(index: 0 | 1 | 2 | 3, text: string) {
    setValues((prev) => {
      const options = [...prev.options] as [string, string, string, string];
      options[index] = text;
      return { ...prev, options };
    });
  }

  async function submit() {
    if (!isValid || pending) return;
    setError(null);
    const outcome = onSubmit({
      stem: values.stem.trim(),
      options: values.options.map((option) => option.trim()) as [
        string,
        string,
        string,
        string,
      ],
      correctIndex: values.correctIndex,
      concept: values.concept.trim(),
      explanation: values.explanation.trim(),
    });
    if (outcome === undefined) {
      onOpenChange(false);
      return;
    }
    const started = session.current;
    setPending(true);
    let message: string | null | undefined;
    try {
      message = await outcome;
    } finally {
      if (session.current === started) setPending(false);
    }
    if (session.current !== started) return;
    if (message) setError(message);
    else onOpenChange(false);
  }

  // Escape, the overlay and the close button cannot dismiss a running save.
  function changeOpen(next: boolean) {
    if (!next && pending) return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        data-testid="question-form-dialog"
        data-technique-theme="exams"
        className="sm:max-w-lg"
      >
        <DialogHeader
          icon={
            <PixelTile
              tone={TECHNIQUE_THEME.exams.tone}
              icon={TECHNIQUE_THEME.exams.icon}
              size={48}
            />
          }
        >
          <DialogTitle>Editar pregunta</DialogTitle>
          <DialogDescription>
            Corrige el enunciado, las 4 opciones o la correcta.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-1 pb-1">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={stemId}>Enunciado</FieldLabel>
            <Textarea
              id={stemId}
              autoFocus
              value={values.stem}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, stem: event.target.value }))
              }
              placeholder="Escribe la pregunta"
              className="rounded-input px-3.5 py-2.5"
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 font-medium text-[13px] text-fg-secondary">
              Opciones · marca la correcta
            </legend>
            {OPTION_LETTERS.map((letter, index) => {
              const correct = values.correctIndex === index;
              return (
                <div
                  key={letter}
                  data-slot="answer-option"
                  data-correct={correct || undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border py-1.5 pr-1.5 pl-3 transition-colors duration-150",
                    correct
                      ? "border-rose-400/50 bg-pastel-pink/35"
                      : "border-border-default bg-card",
                  )}
                >
                  <input
                    type="radio"
                    name="correct-option"
                    aria-label={`Opción ${letter} es la correcta`}
                    checked={values.correctIndex === index}
                    onChange={() =>
                      setValues((prev) => ({
                        ...prev,
                        correctIndex: index as 0 | 1 | 2 | 3,
                      }))
                    }
                    className="size-4 shrink-0 accent-(--theme-ink)"
                  />
                  <span
                    className={cn(
                      "w-4 shrink-0 font-semibold text-xs",
                      correct ? "text-(--theme-ink)" : "text-fg-muted",
                    )}
                  >
                    {letter}
                  </span>
                  <Input
                    value={values.options[index]}
                    onChange={(event) =>
                      updateOption(index as 0 | 1 | 2 | 3, event.target.value)
                    }
                    placeholder={`Opción ${letter}`}
                    className="h-9 rounded-lg border-transparent bg-transparent px-1.5 shadow-none focus-visible:bg-card"
                  />
                </div>
              );
            })}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={conceptId}>Concepto que evalúa</FieldLabel>
            <Input
              id={conceptId}
              value={values.concept}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, concept: event.target.value }))
              }
              placeholder="Fosforilación oxidativa"
              className="h-11 rounded-input px-3.5"
            />
            <p className="text-fg-muted text-xs">
              Corto, por ejemplo: Fosforilación oxidativa
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={explanationId}>
              Explicación (opcional)
            </FieldLabel>
            <Textarea
              id={explanationId}
              value={values.explanation}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  explanation: event.target.value,
                }))
              }
              placeholder="Por qué es correcta esta opción"
              className="rounded-input px-3.5 py-2.5"
            />
          </div>
        </div>

        {error && <FormMessage>{error}</FormMessage>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => changeOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="technique"
            onClick={submit}
            disabled={!isValid || pending}
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
