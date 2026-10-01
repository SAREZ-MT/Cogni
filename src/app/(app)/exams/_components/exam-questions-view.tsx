"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { ExamQuestionRow } from "@/shared/ui/exam-question-row";
import { Pill } from "@/shared/ui/pill";
import {
  QuestionFormDialog,
  type QuestionFormValues,
} from "@/shared/ui/question-form-dialog";
import { SectionHeader } from "@/shared/ui/section-header";
import type { ExamQuestion } from "../_data/sample";

export interface ExamQuestionsViewProps {
  notebookId: string;
  notebookTitle: string;
  pageId: string;
  pageTitle: string;
  initialQuestions: ExamQuestion[];
}

function generateManualId(pageId: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${pageId}-manual-${crypto.randomUUID()}`;
  }
  return `${pageId}-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// "Preguntas del examen" manual creation/editing screen (design preview,
// 2026-09-24; documento-maestro §3.3 "creadas manualmente", Fase 5
// "edición manual de preguntas con concept"). Client-side only: saving
// appends/updates local state, "Retirar" marks a question `retiredAt`
// instead of deleting it (history stays visible) — nothing here persists
// past a remount, same scope as ExamPlayer.
export function ExamQuestionsView({
  notebookId,
  notebookTitle,
  pageId,
  pageTitle,
  initialQuestions,
}: ExamQuestionsViewProps) {
  const [questions, setQuestions] = useState<ExamQuestion[]>(initialQuestions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sessionsHref = `/exams/${notebookId}`;
  const editingQuestion = editingId
    ? questions.find((question) => question.id === editingId)
    : undefined;

  const activeQuestions = questions.filter((question) => !question.retiredAt);
  // A question with no origin renders as "IA" in its row, so the header
  // counts it the same way.
  const manualCount = activeQuestions.filter(
    (question) => question.origin === "manual",
  ).length;
  const aiCount = activeQuestions.length - manualCount;

  function openCreateDialog() {
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEditDialog(id: string) {
    setEditingId(id);
    setDialogOpen(true);
  }

  function retireQuestion(id: string) {
    const today = new Date().toLocaleDateString("es", {
      day: "numeric",
      month: "short",
    });
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id ? { ...question, retiredAt: today } : question,
      ),
    );
  }

  function handleSubmit(values: QuestionFormValues) {
    if (editingId) {
      setQuestions((prev) =>
        prev.map((question) =>
          question.id === editingId
            ? {
                ...question,
                stem: values.stem,
                options: values.options,
                correctIndex: values.correctIndex,
                concept: values.concept,
                explanation: values.explanation || undefined,
              }
            : question,
        ),
      );
    } else {
      setQuestions((prev) => [
        ...prev,
        {
          id: generateManualId(pageId),
          pageId,
          stem: values.stem,
          options: values.options,
          correctIndex: values.correctIndex,
          concept: values.concept,
          explanation: values.explanation || undefined,
          origin: "manual",
        },
      ]);
    }
    setEditingId(null);
  }

  const initialFormValues: QuestionFormValues | undefined = editingQuestion
    ? {
        stem: editingQuestion.stem,
        options: [...editingQuestion.options] as [
          string,
          string,
          string,
          string,
        ],
        correctIndex: editingQuestion.correctIndex,
        concept: editingQuestion.concept,
        explanation: editingQuestion.explanation ?? "",
      }
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 py-8">
      <BackLink href={sessionsHref}>Todos los exámenes</BackLink>

      <SectionHeader
        eyebrow={
          <span className="flex items-center gap-2">
            {`Exámenes · ${notebookTitle}`}
            <Pill size="sm" tone="neutral">
              Vista previa
            </Pill>
          </span>
        }
        title={`${pageTitle} — preguntas`}
        titleClassName="text-xl"
        description={`${activeQuestions.length} preguntas · ${aiCount} generadas por IA · ${manualCount} manuales`}
        actions={
          <Button type="button" onClick={openCreateDialog}>
            <Plus aria-hidden="true" size={16} strokeWidth={2} />
            Nueva pregunta
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        {questions.map((question, index) => (
          <ExamQuestionRow
            key={question.id}
            index={index + 1}
            stem={question.stem}
            concept={question.concept}
            origin={question.origin ?? "ai"}
            options={question.options}
            correctIndex={question.correctIndex}
            retiredAt={question.retiredAt}
            onEdit={() => openEditDialog(question.id)}
            onRetire={
              question.retiredAt ? undefined : () => retireQuestion(question.id)
            }
          />
        ))}
      </div>

      <QuestionFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingId(null);
        }}
        mode={editingId ? "edit" : "create"}
        initialValues={initialFormValues}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
