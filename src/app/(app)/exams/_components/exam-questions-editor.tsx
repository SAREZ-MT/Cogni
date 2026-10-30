"use client";

import {
  type ExamQuestionView,
  MAX_CONCEPT_LENGTH,
  MAX_EXPLANATION_LENGTH,
  MAX_OPTION_LENGTH,
  MAX_STEM_LENGTH,
  normalizeWording,
  saveExamEditsAction,
} from "@/modules/exams";
import { Input } from "@/shared/ui/input";
import { ItemEditor, type ItemErrors } from "@/shared/ui/item-editor";
import { ItemField, invalidProps } from "@/shared/ui/item-field";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/ui/utils";

export interface ExamQuestionDraft {
  stem: string;
  options: [string, string, string, string];
  correctIndex: number;
  concept: string;
  explanation: string;
}

export interface ExamQuestionsEditorProps {
  pageId: string;
  questions: readonly ExamQuestionView[];
}

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

const SAVE_ERRORS: Record<string, string> = {
  EXAMS_LAST_QUESTION: "La página necesita al menos una pregunta.",
  EXAMS_INVALID_QUESTION:
    "Cada pregunta necesita enunciado, 4 opciones distintas y el concepto que evalúa.",
  EXAMS_QUESTION_CHANGED:
    "Una pregunta cambió en otra pestaña. Recarga la página para ver la última versión.",
  EXAMS_QUESTION_NOT_FOUND:
    "Estas preguntas cambiaron mientras las editabas. Recarga la página e intenta de nuevo.",
  EXAMS_QUESTION_RETIRED:
    "Estas preguntas cambiaron mientras las editabas. Recarga la página e intenta de nuevo.",
  PAGE_NOT_FOUND: "Esta página ya no existe.",
  EXAMS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
};
const SAVE_FAILED = "No pudimos guardar los cambios. Intenta de nuevo.";

function tooLong(text: string, max: number): boolean {
  return text.trim().length > max;
}

export function validateExamQuestion(question: ExamQuestionDraft): ItemErrors {
  const errors: ItemErrors = {};
  if (question.stem.trim() === "") errors.stem = "Escribe el enunciado.";
  else if (tooLong(question.stem, MAX_STEM_LENGTH))
    errors.stem = `Máximo ${MAX_STEM_LENGTH} caracteres.`;
  if (question.options.some((option) => option.trim() === "")) {
    errors.options = "Completa las 4 opciones.";
  } else if (
    question.options.some((option) => tooLong(option, MAX_OPTION_LENGTH))
  ) {
    errors.options = `Cada opción admite hasta ${MAX_OPTION_LENGTH} caracteres.`;
  } else if (
    new Set(question.options.map((option) => normalizeWording(option.trim())))
      .size !== question.options.length
  ) {
    errors.options = "Las 4 opciones deben ser distintas.";
  }
  if (question.concept.trim() === "")
    errors.concept = "Escribe el concepto que evalúa.";
  else if (tooLong(question.concept, MAX_CONCEPT_LENGTH))
    errors.concept = `Máximo ${MAX_CONCEPT_LENGTH} caracteres.`;
  if (tooLong(question.explanation, MAX_EXPLANATION_LENGTH)) {
    errors.explanation = `Máximo ${MAX_EXPLANATION_LENGTH} caracteres.`;
  }
  return errors;
}

const toItem = (question: ExamQuestionView) => ({
  id: question.id,
  value: {
    stem: question.stem,
    options: [...question.options] as ExamQuestionDraft["options"],
    correctIndex: question.correctIndex,
    concept: question.concept,
    explanation: question.explanation,
  },
  // Sent back with an edit: a save over a newer change is refused (V10).
  version: question.updatedAt,
});

// The exam questions' edit page (Phase 8 H18): stem, the 4 options, the
// correct one, the concept and the explanation of every active question,
// new questions and real deletions (a deleted question takes its
// reformulated variants), saved together by saveExamEditsAction.
export function ExamQuestionsEditor({
  pageId,
  questions,
}: ExamQuestionsEditorProps) {
  return (
    <ItemEditor<ExamQuestionDraft>
      items={questions.map(toItem)}
      itemLabel="Pregunta"
      addLabel="Añadir pregunta"
      lastItemMessage="La página necesita al menos una pregunta."
      emptyValue={() => ({
        stem: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        concept: "",
        explanation: "",
      })}
      validate={validateExamQuestion}
      renderFields={({ value, onChange, errors, idPrefix }) => (
        <div className="flex flex-col gap-3">
          <ItemField
            id={`${idPrefix}-stem`}
            label="Enunciado"
            error={errors.stem}
          >
            <Textarea
              id={`${idPrefix}-stem`}
              value={value.stem}
              onChange={(event) =>
                onChange({ ...value, stem: event.target.value })
              }
              placeholder="Escribe la pregunta"
              className="rounded-input px-3.5 py-2.5"
              {...invalidProps(`${idPrefix}-stem`, errors.stem)}
            />
          </ItemField>

          <fieldset
            className="flex flex-col gap-2"
            {...invalidProps(`${idPrefix}-options`, errors.options)}
          >
            <legend className="mb-1.5 font-medium text-[13px] text-fg-secondary">
              Opciones · marca la correcta
            </legend>
            <div className="grid gap-2 md:grid-cols-2">
              {OPTION_LETTERS.map((letter, index) => {
                const correct = value.correctIndex === index;
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
                      name={`${idPrefix}-correct`}
                      aria-label={`Opción ${letter} es la correcta`}
                      checked={correct}
                      onChange={() =>
                        onChange({ ...value, correctIndex: index })
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
                      aria-label={`Opción ${letter}`}
                      value={value.options[index]}
                      onChange={(event) => {
                        const options = [
                          ...value.options,
                        ] as ExamQuestionDraft["options"];
                        options[index] = event.target.value;
                        onChange({ ...value, options });
                      }}
                      placeholder={`Opción ${letter}`}
                      className="h-9 rounded-lg border-transparent bg-transparent px-1.5 shadow-none focus-visible:bg-card"
                    />
                  </div>
                );
              })}
            </div>
            {errors.options && (
              <p
                id={`${idPrefix}-options-error`}
                className="text-destructive text-xs"
              >
                {errors.options}
              </p>
            )}
          </fieldset>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <ItemField
              id={`${idPrefix}-concept`}
              label="Concepto que evalúa"
              error={errors.concept}
            >
              <Input
                id={`${idPrefix}-concept`}
                value={value.concept}
                onChange={(event) =>
                  onChange({ ...value, concept: event.target.value })
                }
                placeholder="Un nombre corto"
                className="h-11 rounded-input px-3.5"
                {...invalidProps(`${idPrefix}-concept`, errors.concept)}
              />
            </ItemField>
            <ItemField
              id={`${idPrefix}-explanation`}
              label="Explicación (opcional)"
              error={errors.explanation}
            >
              <Textarea
                id={`${idPrefix}-explanation`}
                value={value.explanation}
                onChange={(event) =>
                  onChange({ ...value, explanation: event.target.value })
                }
                placeholder="Por qué es correcta esta opción"
                className="rounded-input px-3.5 py-2.5"
                {...invalidProps(`${idPrefix}-explanation`, errors.explanation)}
              />
            </ItemField>
          </div>
        </div>
      )}
      onSave={async (operations) => {
        const result = await saveExamEditsAction({
          pageId,
          ...operations,
          updates: operations.updates.map(({ version, ...update }) => ({
            ...update,
            expectedUpdatedAt: version,
          })),
        });
        if (result.ok) return { ok: true, items: result.value.map(toItem) };
        return {
          ok: false,
          message: SAVE_ERRORS[result.error.code] ?? SAVE_FAILED,
        };
      }}
    />
  );
}
