"use client";

import { ClipboardList, Info, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createExamQuestionAction,
  EXAM_MIN_QUESTIONS,
  type ExamQuestionView,
  editExamQuestionAction,
  retireExamQuestionAction,
} from "@/modules/exams";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { ExamQuestionRow } from "@/shared/ui/exam-question-row";
import { IconTile } from "@/shared/ui/icon-tile";
import {
  QuestionFormDialog,
  type QuestionFormValues,
} from "@/shared/ui/question-form-dialog";
import { SectionHeader } from "@/shared/ui/section-header";
import { plural } from "../../flashcards/_lib/plural";

const SAVE_FAILURE = "No pudimos guardar la pregunta. Intenta de nuevo.";
const RETIRE_FAILURE = "No pudimos retirar la pregunta. Intenta de nuevo.";

// Spanish copy per ActionError code of the exams question actions; anything
// else falls back to the generic failure of the action.
const ERROR_COPY: Record<string, string> = {
  EXAMS_INVALID_QUESTION:
    "Revisa la pregunta: las 4 opciones deben ser distintas y ningún campo puede quedar vacío.",
  EXAMS_INVALID_INPUT:
    "Revisa la pregunta: algún campo es demasiado largo o no es válido.",
  EXAMS_QUESTION_RETIRED: "Esta pregunta ya fue retirada.",
  EXAMS_QUESTION_NOT_FOUND: "Esta pregunta ya no existe.",
  EXAMS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
  PAGE_NOT_FOUND: "Esta página ya no existe.",
};

type Tuple4 = readonly [string, string, string, string];
type OptionIndex = 0 | 1 | 2 | 3;

export interface ExamQuestionsViewProps {
  notebookTitle: string;
  pageId: string;
  pageTitle: string;
  // The notebook page the questions belong to ("Volver a la página").
  pageHref: string;
  // The page's active questions, oldest first (retired ones are excluded).
  questions: ExamQuestionView[];
}

// "Preguntas del examen" of one page on real data (documento-maestro §3.3
// "creadas manualmente", Fase 5 "edición manual de preguntas con concept"):
// the active questions, "Nueva pregunta", in-place "Editar" and "Retirar"
// with a confirmation (a retired question leaves the exam and its concept
// leaves the reviews). Every change goes through an exams Server Action and
// refreshes the route, which re-reads the list on the server.
export function ExamQuestionsView({
  notebookTitle,
  pageId,
  pageTitle,
  pageHref,
  questions,
}: ExamQuestionsViewProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [retireError, setRetireError] = useState<string | null>(null);
  const [retiring, startRetire] = useTransition();

  const editing = editingId
    ? questions.find((question) => question.id === editingId)
    : undefined;
  const manualCount = questions.filter((q) => q.origin === "manual").length;
  const aiCount = questions.length - manualCount;
  const missing = EXAM_MIN_QUESTIONS - questions.length;

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  async function save(values: QuestionFormValues): Promise<string | null> {
    try {
      const result = editingId
        ? await editExamQuestionAction({ questionId: editingId, ...values })
        : await createExamQuestionAction({ pageId, ...values });
      if (!result.ok) return ERROR_COPY[result.error.code] ?? SAVE_FAILURE;
    } catch {
      return SAVE_FAILURE;
    }
    router.refresh();
    return null;
  }

  function openRetire(id: string) {
    setRetireError(null);
    setRetiringId(id);
  }

  function confirmRetire() {
    if (!retiringId) return;
    const questionId = retiringId;
    setRetireError(null);
    startRetire(async () => {
      let result: Awaited<ReturnType<typeof retireExamQuestionAction>>;
      try {
        result = await retireExamQuestionAction({ questionId });
      } catch {
        setRetireError(RETIRE_FAILURE);
        return;
      }
      if (!result.ok) {
        setRetireError(ERROR_COPY[result.error.code] ?? RETIRE_FAILURE);
        return;
      }
      setRetiringId(null);
      router.refresh();
    });
  }

  const initialValues: QuestionFormValues | undefined = editing
    ? {
        stem: editing.stem,
        options: [...editing.options] as [string, string, string, string],
        correctIndex: editing.correctIndex as OptionIndex,
        concept: editing.concept,
        explanation: editing.explanation,
      }
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 py-8">
      <BackLink href={pageHref}>Volver a la página</BackLink>

      <SectionHeader
        eyebrow={`Exámenes · ${notebookTitle}`}
        title={`${pageTitle} — preguntas`}
        titleClassName="text-xl"
        description={[
          plural(questions.length, "pregunta", "preguntas"),
          plural(aiCount, "generada por IA", "generadas por IA"),
          plural(manualCount, "manual", "manuales"),
        ].join(" · ")}
        actions={
          <Button
            type="button"
            onClick={openCreate}
            data-testid="new-exam-question-button"
          >
            <Plus aria-hidden="true" size={16} strokeWidth={2} />
            Nueva pregunta
          </Button>
        }
      />

      {missing > 0 && (
        <p
          data-testid="exam-questions-minimum"
          className="flex items-start gap-2 rounded-xl border border-border-subtle bg-card px-4 py-3 text-[13px] text-fg-secondary"
        >
          <Info
            aria-hidden="true"
            size={16}
            strokeWidth={1.75}
            className="mt-px shrink-0 text-fg-muted"
          />
          {`Un examen necesita al menos ${EXAM_MIN_QUESTIONS} preguntas. Agrega ${missing} más para poder rendirlo.`}
        </p>
      )}

      {questions.length === 0 ? (
        <EmptyState
          fill
          icon={
            <IconTile size="56" tone="pink">
              <ClipboardList aria-hidden="true" size={28} strokeWidth={1.75} />
            </IconTile>
          }
          title="Esta página aún no tiene preguntas"
          titleClassName="text-base"
          description="Crea la primera con Nueva pregunta: enunciado, 4 opciones, la correcta y el concepto que evalúa."
          descriptionClassName="max-w-[380px]"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((question, index) => (
            <ExamQuestionRow
              key={question.id}
              index={index + 1}
              stem={question.stem}
              concept={question.concept}
              origin={question.origin}
              options={question.options as unknown as Tuple4}
              correctIndex={question.correctIndex as OptionIndex}
              onEdit={() => openEdit(question.id)}
              onRetire={() => openRetire(question.id)}
            />
          ))}
        </div>
      )}

      <QuestionFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(null);
        }}
        mode={editingId ? "edit" : "create"}
        initialValues={initialValues}
        onSubmit={save}
      />

      <Dialog
        open={retiringId !== null}
        onOpenChange={(open) => {
          if (!open) setRetiringId(null);
        }}
      >
        <DialogContent data-testid="retire-exam-question-dialog">
          <DialogHeader>
            <DialogTitle>¿Retirar esta pregunta?</DialogTitle>
            <DialogDescription>
              Sale de tus exámenes y de tus repasos. Su historial se conserva.
            </DialogDescription>
          </DialogHeader>
          {retireError && (
            <p role="alert" className="text-destructive text-sm">
              {retireError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRetiringId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRetire}
              disabled={retiring}
            >
              {retiring ? "Retirando…" : "Retirar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
