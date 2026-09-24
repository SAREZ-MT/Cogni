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
import { type StatDotItem, StatDots } from "@/shared/ui/stat-dots";
import type { RecallQuestion } from "../_data/sample";
import { ActiveRecallResultsView } from "./active-recall-results-view";
import {
  type QuestionRecord,
  SELF_RATING_BUCKET_META,
  SELF_RATING_BUCKET_ORDER,
  selfRatingBucketFor,
} from "./self-rating";

export interface ActiveRecallPlayerProps {
  notebookId: string;
  notebookTitle: string;
  pageTitle: string;
  questions: RecallQuestion[];
}

type Phase = "answer" | "review";

// Client Active recall session (design preview, documento-maestro §3.3 +
// studyplatform-active-recall-style.md, adapted so feedback only shows at
// the end — never between questions). Each answered/skipped question is
// kept as a `QuestionRecord` so the end-of-session `ActiveRecallResultsView`
// (documento-maestro §8.5: async evaluation, in-page results instead of an
// overlay) can render its own per-question feedback list. All state is
// local and resets on remount; nothing is persisted (no backend yet, same
// scope as FlashcardPlayer).
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
  const [records, setRecords] = useState<QuestionRecord[]>([]);
  const [finished, setFinished] = useState(false);

  const total = questions.length;
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;
  const question = questions[index];
  const sessionsHref = `/active-recall/${notebookId}`;

  function completeQuestion(rating: number, answer: string) {
    if (question) {
      setRecords((prev) => [
        ...prev,
        {
          id: question.id,
          prompt: question.prompt,
          answer,
          selfRating: rating,
        },
      ]);
    }
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
    const answer = "(sin respuesta)";
    setSubmittedAnswer(answer);
    completeQuestion(0, answer);
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
    setRecords([]);
    setFinished(false);
  }

  const statDotItems: StatDotItem[] = SELF_RATING_BUCKET_ORDER.map(
    (bucket) => ({
      key: bucket,
      count: records.filter(
        (record) => selfRatingBucketFor(record.selfRating) === bucket,
      ).length,
      dotClassName: SELF_RATING_BUCKET_META[bucket].dotClassName,
    }),
  );

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

  if (finished) {
    return (
      <ActiveRecallResultsView
        pageTitle={pageTitle}
        records={records}
        sessionsHref={sessionsHref}
        onRestart={restart}
      />
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
          <DifficultyScale
            onSelect={(rating) => completeQuestion(rating, submittedAnswer)}
          />
        </div>
      )}
    </div>
  );
}
