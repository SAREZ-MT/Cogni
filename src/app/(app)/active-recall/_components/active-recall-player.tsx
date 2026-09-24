"use client";

import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { AnswerTextarea } from "@/shared/ui/answer-textarea";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { DifficultyScale } from "@/shared/ui/difficulty-scale";
import { FeedbackBlock } from "@/shared/ui/feedback-block";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { QuestionCard } from "@/shared/ui/question-card";
import {
  FeedbackPlaceholder,
  SessionSummary,
  type SessionSummaryStat,
} from "@/shared/ui/session-summary";
import { type StatDotItem, StatDots } from "@/shared/ui/stat-dots";
import type { RecallQuestion } from "../_data/sample";

export interface ActiveRecallPlayerProps {
  notebookId: string;
  notebookTitle: string;
  pageTitle: string;
  questions: RecallQuestion[];
}

// Self-rating (0-5) → tally tone, documento-maestro §3.3: 0-1 "por
// reforzar", 2-3 "regular", 4-5 "dominadas".
type TallyTone = "reforzar" | "regular" | "dominadas";

function tallyToneForRating(rating: number): TallyTone {
  if (rating <= 1) return "reforzar";
  if (rating <= 3) return "regular";
  return "dominadas";
}

const TALLY_META: Record<
  TallyTone,
  { label: string; dotClassName: string; toneClassName: string }
> = {
  reforzar: {
    label: "Por reforzar",
    dotClassName: "bg-error-500",
    toneClassName: "text-error-600",
  },
  regular: {
    label: "Regular",
    dotClassName: "bg-warning-500",
    toneClassName: "text-warning-600",
  },
  dominadas: {
    label: "Dominadas",
    dotClassName: "bg-success-500",
    toneClassName: "text-success-600",
  },
};

const TALLY_ORDER: TallyTone[] = ["reforzar", "regular", "dominadas"];

type Phase = "answer" | "review";

// Client Active recall session (design preview, documento-maestro §3.3 +
// studyplatform-active-recall-style.md, adapted so feedback only shows at
// the end — never between questions). All state is local and resets on
// remount; nothing is persisted (no backend yet, same scope as
// FlashcardPlayer).
export function ActiveRecallPlayer({
  notebookId,
  notebookTitle,
  pageTitle,
  questions,
}: ActiveRecallPlayerProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [answerText, setAnswerText] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [tally, setTally] = useState({ reforzar: 0, regular: 0, dominadas: 0 });
  const [ratingSum, setRatingSum] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const total = questions.length;
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;
  const question = questions[index];
  const sessionsHref = `/active-recall/${notebookId}`;

  function completeQuestion(rating: number) {
    const tone = tallyToneForRating(rating);
    setTally((prev) => ({ ...prev, [tone]: prev[tone] + 1 }));
    setRatingSum((prev) => prev + rating);
    setAnsweredCount((prev) => prev + 1);
    if (index + 1 >= total) {
      setFinished(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setPhase("answer");
    setAnswerText("");
    setSubmittedAnswer("");
  }

  function handleSkip() {
    setSubmittedAnswer("(sin respuesta)");
    completeQuestion(0);
  }

  function handleCalificar() {
    setSubmittedAnswer(answerText.trim() || "(sin respuesta)");
    setPhase("review");
  }

  function restart() {
    setIndex(0);
    setPhase("answer");
    setAnswerText("");
    setSubmittedAnswer("");
    setTally({ reforzar: 0, regular: 0, dominadas: 0 });
    setRatingSum(0);
    setAnsweredCount(0);
    setFinished(false);
  }

  const statDotItems: StatDotItem[] = TALLY_ORDER.map((tone) => ({
    key: tone,
    count: tally[tone],
    dotClassName: TALLY_META[tone].dotClassName,
  }));
  const summaryStats: SessionSummaryStat[] = TALLY_ORDER.map((tone) => ({
    key: tone,
    label: TALLY_META[tone].label,
    value: tally[tone],
    toneClassName: TALLY_META[tone].toneClassName,
  }));
  const averageRating = answeredCount > 0 ? ratingSum / answeredCount : 0;
  const averageRatingLabel = averageRating.toLocaleString("es-ES", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });

  if (total === 0 || !question) {
    return (
      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col items-center justify-center gap-6 py-16">
        <BackLink href={sessionsHref}>Todas las sesiones</BackLink>
        <p className="text-fg-muted text-sm">
          Esta página no tiene preguntas todavía.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="active-recall-session"
      className="mx-auto flex w-full max-w-[680px] flex-1 flex-col gap-[22px] py-8"
    >
      <BackLink href={sessionsHref}>Todas las sesiones</BackLink>

      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-[16px] text-fg">
            Active recall — {notebookTitle}
          </p>
          <p className="mt-0.5 text-fg-muted text-xs">{pageTitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <StatDots items={statDotItems} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-fg-muted"
            onClick={() => setFinished(true)}
          >
            <X aria-hidden="true" size={13} strokeWidth={2} />
            Terminar
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-fg-secondary">
            Pregunta {index + 1} de {total}
          </span>
          <span className="text-fg-muted text-xs">{progress}%</span>
        </div>
        <ProgressBar
          value={progress}
          className="h-1.5"
          fillClassName="bg-success-500 transition-[width] duration-[400ms] ease-out"
        />
      </div>

      <QuestionCard question={question.prompt} />

      {phase === "answer" ? (
        <div className="flex flex-col gap-3">
          <AnswerTextarea
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            placeholder="Escribe tu respuesta de memoria, sin consultar los apuntes..."
          />
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="px-5"
              onClick={handleSkip}
            >
              Saltar
            </Button>
            <Button
              type="button"
              className="flex-1 justify-center font-medium text-[15px]"
              onClick={handleCalificar}
            >
              Calificar respuesta
              <ArrowRight aria-hidden="true" size={15} strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <FeedbackBlock eyebrowLabel="Tu respuesta">
            {submittedAnswer}
          </FeedbackBlock>
          <DifficultyScale onSelect={completeQuestion} />
        </div>
      )}

      {finished && (
        <SessionSummary
          emoji="🧠"
          title="Sesión completada"
          subtitle={`${pageTitle} — ${answeredCount} preguntas respondidas`}
          stats={summaryStats}
          highlightBeforeFeedback
          highlight={
            <>
              <p className="text-[13px] text-fg-muted">
                Autoevaluación promedio
              </p>
              <div className="mt-1.5 flex items-center gap-3">
                <ProgressBar
                  value={(averageRating / 5) * 100}
                  className="h-2 flex-1"
                  fillClassName="bg-success-500"
                />
                <span className="font-semibold text-[15px] text-fg">
                  {averageRatingLabel} / 5
                </span>
              </div>
            </>
          }
          feedback={
            <FeedbackPlaceholder description="La IA evaluará tus respuestas con la rúbrica de la página y te dirá qué reforzar." />
          }
          secondaryAction={{
            label: "Volver a las sesiones",
            href: sessionsHref,
          }}
          primaryAction={{ label: "Nueva sesión →", onClick: restart }}
        />
      )}
    </div>
  );
}
