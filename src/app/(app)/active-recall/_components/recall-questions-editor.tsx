"use client";

import {
  type RecallQuestionView,
  saveRecallEditsAction,
} from "@/modules/active-recall";
import { ItemEditor, type ItemErrors } from "@/shared/ui/item-editor";
import { ItemField, invalidProps } from "@/shared/ui/item-field";
import { Textarea } from "@/shared/ui/textarea";

// One question as the edit page holds it: the key concepts as typed, one
// per line, so editing them feels like plain text.
export interface RecallQuestionDraft {
  prompt: string;
  keyConcepts: string;
  acceptableAnswerSummary: string;
}

export interface RecallQuestionsEditorProps {
  pageId: string;
  questions: readonly RecallQuestionView[];
}

const SAVE_ERRORS: Record<string, string> = {
  RECALL_LAST_QUESTION: "La página necesita al menos una pregunta.",
  RECALL_INVALID_QUESTION:
    "Cada pregunta necesita enunciado, al menos un concepto clave y la respuesta esperada.",
  RECALL_QUESTION_NOT_FOUND:
    "Estas preguntas cambiaron mientras las editabas. Recarga la página e intenta de nuevo.",
  PAGE_NOT_FOUND: "Esta página ya no existe.",
  RECALL_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
};
const SAVE_FAILED = "No pudimos guardar los cambios. Intenta de nuevo.";

export function conceptsOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function validateRecallQuestion(
  question: RecallQuestionDraft,
): ItemErrors {
  const errors: ItemErrors = {};
  if (question.prompt.trim() === "") errors.prompt = "Escribe la pregunta.";
  if (conceptsOf(question.keyConcepts).length === 0) {
    errors.keyConcepts = "Escribe al menos un concepto clave.";
  }
  if (question.acceptableAnswerSummary.trim() === "") {
    errors.acceptableAnswerSummary = "Escribe la respuesta esperada.";
  }
  return errors;
}

const toItem = (question: RecallQuestionView) => ({
  id: question.id,
  value: {
    prompt: question.prompt,
    keyConcepts: question.keyConcepts.join("\n"),
    acceptableAnswerSummary: question.acceptableAnswerSummary,
  },
});

const toContent = ({ keyConcepts, ...rest }: RecallQuestionDraft) => ({
  ...rest,
  keyConcepts: conceptsOf(keyConcepts),
});

// The recall questions' edit page (Phase 8 H18): the question, the key
// concepts the evaluation looks for and the expected answer of every
// question, new questions and real deletions, saved together by
// saveRecallEditsAction.
export function RecallQuestionsEditor({
  pageId,
  questions,
}: RecallQuestionsEditorProps) {
  return (
    <ItemEditor<RecallQuestionDraft>
      items={questions.map(toItem)}
      itemLabel="Pregunta"
      addLabel="Añadir pregunta"
      lastItemMessage="La página necesita al menos una pregunta."
      emptyValue={() => ({
        prompt: "",
        keyConcepts: "",
        acceptableAnswerSummary: "",
      })}
      validate={validateRecallQuestion}
      renderFields={({ value, onChange, errors, idPrefix }) => (
        <div className="flex flex-col gap-3">
          <ItemField
            id={`${idPrefix}-prompt`}
            label="Pregunta"
            error={errors.prompt}
          >
            <Textarea
              id={`${idPrefix}-prompt`}
              value={value.prompt}
              onChange={(event) =>
                onChange({ ...value, prompt: event.target.value })
              }
              placeholder="¿Qué quieres explicar de memoria?"
              className="rounded-input px-3.5 py-2.5"
              {...invalidProps(`${idPrefix}-prompt`, errors.prompt)}
            />
          </ItemField>
          <div className="grid gap-3 md:grid-cols-2">
            <ItemField
              id={`${idPrefix}-concepts`}
              label="Conceptos clave"
              error={errors.keyConcepts}
              hint="Uno por línea. La evaluación busca estos conceptos."
            >
              <Textarea
                id={`${idPrefix}-concepts`}
                value={value.keyConcepts}
                onChange={(event) =>
                  onChange({ ...value, keyConcepts: event.target.value })
                }
                placeholder={"Concepto A\nConcepto B"}
                className="rounded-input px-3.5 py-2.5"
                {...invalidProps(`${idPrefix}-concepts`, errors.keyConcepts)}
              />
            </ItemField>
            <ItemField
              id={`${idPrefix}-summary`}
              label="Respuesta esperada"
              error={errors.acceptableAnswerSummary}
            >
              <Textarea
                id={`${idPrefix}-summary`}
                value={value.acceptableAnswerSummary}
                onChange={(event) =>
                  onChange({
                    ...value,
                    acceptableAnswerSummary: event.target.value,
                  })
                }
                placeholder="Lo que debería decir una buena respuesta"
                className="rounded-input px-3.5 py-2.5"
                {...invalidProps(
                  `${idPrefix}-summary`,
                  errors.acceptableAnswerSummary,
                )}
              />
            </ItemField>
          </div>
        </div>
      )}
      onSave={async ({ updates, creates, deletes }) => {
        const result = await saveRecallEditsAction({
          pageId,
          updates: updates.map(({ id, ...draft }) => ({
            id,
            ...toContent(draft),
          })),
          creates: creates.map(toContent),
          deletes,
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
