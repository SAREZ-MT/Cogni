"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

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
  mode: "create" | "edit";
  // Prefills the form for `mode="edit"`; ignored for `mode="create"`.
  initialValues?: QuestionFormValues;
  onSubmit: (values: QuestionFormValues) => void;
}

// Manual question creation/editing dialog (design preview, 2026-09-24;
// documento-maestro §3.3 "creadas manualmente", Fase 5 "edición manual de
// preguntas con concept") — built on Cogni's Dialog atom, same composition
// pattern as modules/notebooks/ui/create-notebook-dialog.tsx. Client-side
// only: the caller (exam-questions-view.tsx) owns the actual add/edit
// local state; this atom only collects and validates the form values.
export function QuestionFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  onSubmit,
}: QuestionFormDialogProps) {
  const [values, setValues] = useState<QuestionFormValues>(
    initialValues ?? EMPTY_VALUES,
  );
  const stemId = useId();
  const conceptId = useId();
  const explanationId = useId();

  // Re-syncs the form every time the dialog opens (both a fresh "Nueva
  // pregunta" and a re-opened "Editar" for a different row use the same
  // controlled `open` prop) instead of keying/remounting the component.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-sync on the open transition, not on every initialValues identity change while open.
  useEffect(() => {
    if (open) setValues(initialValues ?? EMPTY_VALUES);
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

  function submit() {
    if (!isValid) return;
    onSubmit({
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
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="question-form-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar pregunta" : "Nueva pregunta"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={stemId} className="text-fg-secondary text-sm">
              Enunciado
            </label>
            <Textarea
              id={stemId}
              autoFocus
              value={values.stem}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, stem: event.target.value }))
              }
              placeholder="Escribe la pregunta"
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-fg-secondary text-sm">
              Opciones · marca la correcta
            </legend>
            {OPTION_LETTERS.map((letter, index) => (
              <div key={letter} className="flex items-center gap-2">
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
                  className="size-4 shrink-0 accent-pastel-pink-fg"
                />
                <span className="w-4 shrink-0 font-medium text-fg-muted text-xs">
                  {letter}
                </span>
                <Input
                  value={values.options[index]}
                  onChange={(event) =>
                    updateOption(index as 0 | 1 | 2 | 3, event.target.value)
                  }
                  placeholder={`Opción ${letter}`}
                />
              </div>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={conceptId} className="text-fg-secondary text-sm">
              Concepto que evalúa
            </label>
            <Input
              id={conceptId}
              value={values.concept}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, concept: event.target.value }))
              }
              placeholder="Fosforilación oxidativa"
            />
            <p className="text-[11px] text-fg-muted">
              Corto, por ejemplo: Fosforilación oxidativa
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={explanationId}
              className="text-fg-secondary text-sm"
            >
              Explicación (opcional)
            </label>
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
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={!isValid}>
            {mode === "edit" ? "Guardar cambios" : "Guardar pregunta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
