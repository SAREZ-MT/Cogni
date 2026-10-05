"use client";

import { ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  answerExamQuestionAction,
  type ExamAnswerView,
  type ExamPlayerQuestionView,
  type ExamSessionView,
  finishExamSessionAction,
} from "@/modules/exams";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { OptionRow, type OptionRowState } from "@/shared/ui/option-row";
import { Pill } from "@/shared/ui/pill";
import { QuestionCard } from "@/shared/ui/question-card";
import { QuestionProgressDots } from "@/shared/ui/question-progress-dots";
import { StatusBanner } from "@/shared/ui/status-banner";
import { TimerChip } from "@/shared/ui/timer-chip";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
const ANSWER_FAILURE = "No pudimos guardar tu respuesta. Intenta de nuevo.";
const FINISH_FAILURE = "No pudimos cerrar el examen. Intenta de nuevo.";

export interface ExamPlayerProps {
  notebookId: string;
  pageTitle: string;
  pageHref: string;
  session: ExamSessionView;
}

function elapsedSeconds(startedAt: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
  );
}

function firstUnanswered(questions: ExamPlayerQuestionView[]): number {
  const index = questions.findIndex((question) => question.answer === null);
  return index === -1 ? Math.max(0, questions.length - 1) : index;
}

function optionState(
  optionIndex: number,
  answer: ExamAnswerView | null,
): OptionRowState {
  if (!answer) return "default";
  if (optionIndex === answer.correctIndex) return "correct";
  if (optionIndex === answer.selectedIndex) return "incorrect";
  return "muted";
}

// A page's exam on real data (documento-maestro §3.3; Phase 5 T6). One
// question at a time: choosing an option grades it on the server
// (answerExamQuestionAction) and reveals right or wrong with the question's
// explanation; the AI feedback comes at the end (T8). The elapsed time
// counts from the session's start, so a resumed exam keeps its clock (user
// decision 2026-10-05: the only time metric, shown here and in the
// results). When every question is answered, "Ver resultados" finishes the
// session and opens its results.
export function ExamPlayer({
  notebookId,
  pageTitle,
  pageHref,
  session,
}: ExamPlayerProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState(session.questions);
  const [index, setIndex] = useState(() => firstUnanswered(session.questions));
  const [seconds, setSeconds] = useState(() =>
    elapsedSeconds(session.startedAt),
  );
  const [error, setError] = useState<string | null>(null);
  const [answering, startAnswer] = useTransition();
  const [finishing, startFinish] = useTransition();

  useEffect(() => {
    const id = setInterval(
      () => setSeconds(elapsedSeconds(session.startedAt)),
      1000,
    );
    return () => clearInterval(id);
  }, [session.startedAt]);

  const total = questions.length;
  const question = questions[index];
  const answered = useMemo(
    () =>
      new Set(
        questions.flatMap((q, questionIndex) =>
          q.answer ? [questionIndex] : [],
        ),
      ),
    [questions],
  );
  const allAnswered = answered.size === total;
  const reachable = firstUnanswered(questions);

  function choose(optionIndex: number) {
    if (!question || question.answer || answering) return;
    const questionId = question.id;
    setError(null);
    startAnswer(async () => {
      try {
        const result = await answerExamQuestionAction({
          sessionId: session.sessionId,
          questionId,
          selectedIndex: optionIndex,
        });
        if (!result.ok) {
          setError(ANSWER_FAILURE);
          return;
        }
        const answer = result.value;
        setQuestions((previous) =>
          previous.map((q) => (q.id === questionId ? { ...q, answer } : q)),
        );
      } catch {
        setError(ANSWER_FAILURE);
      }
    });
  }

  function finish() {
    setError(null);
    startFinish(async () => {
      try {
        const result = await finishExamSessionAction({
          sessionId: session.sessionId,
        });
        if (!result.ok) {
          setError(FINISH_FAILURE);
          return;
        }
      } catch {
        setError(FINISH_FAILURE);
        return;
      }
      router.push(
        `/exams/${notebookId}/${session.pageId}/resultados?sesion=${session.sessionId}`,
      );
    });
  }

  if (!question) return null;
  const answer = question.answer;
  const isLast = index + 1 >= total;

  return (
    <div
      data-testid="exam-session"
      className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 py-8"
    >
      <BackLink href={pageHref}>Volver a la página</BackLink>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-[18px] text-fg">
              Examen — {pageTitle}
            </p>
            {session.isRetake && (
              <Pill data-testid="exam-retake-label" size="sm" tone="rose">
                Repetición
              </Pill>
            )}
          </div>
          <p className="mt-0.5 text-fg-muted text-xs">
            {session.isRetake
              ? `${total} preguntas · lo que fallaste vuelve reformulado`
              : `${total} preguntas de opción múltiple`}
          </p>
        </div>
        <TimerChip seconds={seconds} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-fg-secondary">
            Pregunta {index + 1} de {total}
          </span>
          <span
            data-testid="exam-answered-count"
            className="text-fg-muted text-xs"
          >
            {answered.size} respondidas
          </span>
        </div>
        <QuestionProgressDots
          total={total}
          current={index}
          answered={answered}
          onJump={(target) => {
            if (target <= reachable) setIndex(target);
          }}
        />
      </div>

      <QuestionCard
        eyebrowLabel={`Pregunta ${index + 1} de ${total}`}
        question={question.stem}
      />

      <div className="flex flex-col gap-2.5" data-testid="exam-options">
        {question.options.map((option, optionIndex) => (
          <OptionRow
            // biome-ignore lint/suspicious/noArrayIndexKey: options are a fixed 4-item A–D sequence that never reorders.
            key={optionIndex}
            index={optionIndex}
            letter={OPTION_LETTERS[optionIndex] ?? ""}
            text={option}
            state={optionState(optionIndex, answer)}
            disabled={answer !== null || answering}
            onClick={() => choose(optionIndex)}
          />
        ))}
      </div>

      {answer && (
        <StatusBanner
          data-testid="exam-answer-reveal"
          tone={answer.isCorrect ? "success" : "error"}
          title={answer.isCorrect ? "¡Correcto!" : "Incorrecto"}
          description={
            answer.explanation ||
            `La respuesta correcta es la ${OPTION_LETTERS[answer.correctIndex]}.`
          }
        />
      )}

      {error && (
        <p
          role="alert"
          data-testid="exam-player-error"
          className="text-[13px] text-error-600"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2.5">
        {allAnswered && isLast ? (
          <Button
            type="button"
            onClick={finish}
            disabled={finishing}
            data-testid="finish-exam-button"
          >
            {finishing ? "Calificando…" : "Ver resultados"}
            <Check aria-hidden="true" size={15} strokeWidth={2.5} />
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!answer || isLast}
            onClick={() => setIndex(index + 1)}
            data-testid="next-question-button"
          >
            Siguiente
            <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
          </Button>
        )}
      </div>
    </div>
  );
}
