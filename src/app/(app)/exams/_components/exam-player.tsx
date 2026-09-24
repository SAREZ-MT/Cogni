"use client";

import { Check, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { OptionRow } from "@/shared/ui/option-row";
import { QuestionCard } from "@/shared/ui/question-card";
import { QuestionProgressDots } from "@/shared/ui/question-progress-dots";
import { StatusBanner } from "@/shared/ui/status-banner";
import { TimerChip } from "@/shared/ui/timer-chip";
import {
  type ExamQuestion,
  MITOCONDRIA_RETAKE_CONCEPTS,
} from "../_data/sample";
import { ExamResultsView } from "./exam-results-view";

export interface ExamPlayerProps {
  notebookId: string;
  notebookTitle: string;
  pageId: string;
  pageTitle: string;
  questions: ExamQuestion[];
  isRetake: boolean;
}

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

function emptyAnswers(total: number): Array<number | null> {
  return Array.from({ length: total }, () => null);
}

// Exam session (design preview, documento-maestro §3.3/§7.5:
// studyplatform-exams-style.md player, adapted onto Cogni atoms). No
// correct/incorrect ever shows while taking the exam — the student can
// submit at any time via "Entregar"/"Enviar examen", and every unanswered
// question counts as incorrect at grading time. All state is local and
// resets on remount; nothing is persisted (no backend yet, same scope as
// FlashcardPlayer/ActiveRecallPlayer).
export function ExamPlayer({
  notebookId,
  notebookTitle,
  pageId,
  pageTitle,
  questions,
  isRetake,
}: ExamPlayerProps) {
  const total = questions.length;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() =>
    emptyAnswers(total),
  );
  const [seconds, setSeconds] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [submitted]);

  const sessionsHref = `/exams/${notebookId}`;
  const question = questions[index];
  const answeredCount = answers.filter((value) => value !== null).length;
  const answeredIndices = useMemo(
    () =>
      new Set(
        answers.flatMap((value, questionIndex) =>
          value !== null ? [questionIndex] : [],
        ),
      ),
    [answers],
  );

  function selectOption(optionIndex: number) {
    setAnswers((prev) =>
      prev.map((value, questionIndex) =>
        questionIndex === index ? optionIndex : value,
      ),
    );
  }

  function goToIndex(target: number) {
    setIndex(Math.max(0, Math.min(total - 1, target)));
  }

  function restart() {
    setIndex(0);
    setAnswers(emptyAnswers(total));
    setSeconds(0);
    setSubmitted(false);
  }

  if (total === 0 || !question) {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-6 py-16">
        <BackLink href={sessionsHref}>Todos los exámenes</BackLink>
        <p className="text-fg-muted text-sm">
          Esta página no tiene preguntas todavía.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <ExamResultsView
        notebookId={notebookId}
        pageId={pageId}
        notebookTitle={notebookTitle}
        pageTitle={pageTitle}
        questions={questions}
        answers={answers}
        seconds={seconds}
        onRestart={restart}
      />
    );
  }

  const isLastQuestion = index + 1 >= total;

  return (
    <div
      data-testid="exam-session"
      className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 py-8"
    >
      <BackLink href={sessionsHref}>Todos los exámenes</BackLink>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-[18px] text-fg">Examen — {pageTitle}</p>
          <p className="mt-0.5 text-fg-muted text-xs">
            {total} preguntas de opción múltiple
            {isRetake ? " · Examen de repetición" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <TimerChip seconds={seconds} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-fg-muted"
            onClick={() => setSubmitted(true)}
          >
            <Send aria-hidden="true" size={13} strokeWidth={2} />
            Entregar
          </Button>
        </div>
      </div>

      {isRetake && (
        <StatusBanner
          tone="rose"
          title="Examen de repetición"
          description={`Preguntas nuevas sobre los conceptos que fallaste: ${MITOCONDRIA_RETAKE_CONCEPTS.join(", ")}.`}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-fg-secondary">
            Pregunta {index + 1} de {total}
          </span>
          <span className="text-fg-muted text-xs">
            {answeredCount} respondidas
          </span>
        </div>
        <QuestionProgressDots
          total={total}
          current={index}
          answered={answeredIndices}
          onJump={goToIndex}
        />
      </div>

      <QuestionCard
        eyebrowLabel={`Pregunta ${index + 1} de ${total}`}
        question={question.stem}
      />

      <div className="flex flex-col gap-2.5">
        {question.options.map((option, optionIndex) => (
          <OptionRow
            // biome-ignore lint/suspicious/noArrayIndexKey: options are a fixed 4-item A–D sequence that never reorders.
            key={optionIndex}
            index={optionIndex}
            letter={OPTION_LETTERS[optionIndex]}
            text={option}
            state={answers[index] === optionIndex ? "selected" : "default"}
            onClick={() => selectOption(optionIndex)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2.5">
        <Button
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => goToIndex(index - 1)}
        >
          Anterior
        </Button>
        {isLastQuestion ? (
          <Button
            type="button"
            className="bg-pastel-pink-fg text-white hover:bg-pastel-pink-fg"
            onClick={() => setSubmitted(true)}
          >
            Enviar examen
            <Check aria-hidden="true" size={15} strokeWidth={2.5} />
          </Button>
        ) : (
          <Button
            type="button"
            disabled={answers[index] === null}
            onClick={() => goToIndex(index + 1)}
          >
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}
