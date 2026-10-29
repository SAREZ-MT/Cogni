"use client";

import { ArrowRight, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  finishRecallSessionAction,
  saveRecallAnswerAction,
  startRecallSessionAction,
} from "@/modules/active-recall";
import { hubHref } from "@/shared/navigation/technique-hub";
import { AnswerTextarea } from "@/shared/ui/answer-textarea";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { DifficultyScale } from "@/shared/ui/difficulty-scale";
import { FeedbackBlock } from "@/shared/ui/feedback-block";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { QuestionCard } from "@/shared/ui/question-card";
import { type StatDotItem, StatDots } from "@/shared/ui/stat-dots";
import { ActiveRecallResultsView } from "./active-recall-results-view";
import {
  type QuestionRecord,
  SELF_RATING_BUCKET_META,
  SELF_RATING_BUCKET_ORDER,
  selfRatingBucketFor,
} from "./self-rating";

// What the player shows of a question (never its rubric).
export interface RecallPlayerQuestion {
  id: string;
  prompt: string;
}

export interface ActiveRecallPlayerProps {
  notebookId: string;
  notebookTitle: string;
  pageTitle: string;
  // The page of a real session (Phase 6 T5): every answer is saved through
  // the session Server Actions. Without it (design preview) nothing is
  // persisted.
  pageId?: string;
  questions: RecallPlayerQuestion[];
  // Where "Todas las sesiones" (and the results' link) lead: the notebook
  // view by default, the hub when opened from its create dialog (Phase 8
  // H16).
  backHref?: string;
}

const SKIPPED_ANSWER = "(sin respuesta)";

type Phase = "answer" | "review";

// Client Active recall session (documento-maestro §3.3 +
// studyplatform-active-recall-style.md, adapted so feedback only shows at
// the end — never between questions). Each answered/skipped question is
// kept as a `QuestionRecord` so the end-of-session `ActiveRecallResultsView`
// (documento-maestro §8.5: async evaluation, in-page results instead of an
// overlay) can render its own per-question feedback list.
//
// With a `pageId` the session is real (Phase 6 T5) and the screen stays the
// same: the first saved answer starts the session (so opening the route
// never leaves an empty one), each "Calificar respuesta" + self-rating and
// each "Saltar" is saved as it is given, and "Terminar" or the last
// question finishes the session once its saves are done. Saves run in
// order on a queue in the background, so the player never waits for the
// network; a failed save or start is not shown (no error UI under the Phase
// 6 UI freeze): the flow goes on and the next answer starts the session
// again if it never started. "Nueva sesión" starts a new session and shows
// its questions.
// One player run: the DB session its queued saves and finish target, set
// when the run's session starts.
interface RecallRun {
  sessionId: string | null;
}

export function ActiveRecallPlayer({
  notebookId,
  notebookTitle,
  pageTitle,
  pageId,
  questions: initialQuestions,
  backHref,
}: ActiveRecallPlayerProps) {
  const [questions, setQuestions] = useState(initialQuestions);
  // The session the queued tasks write to. Each task captures the run that
  // was current when it was queued, so "Nueva sesión" (a new run) never
  // moves the previous run's pending answers into the new session and
  // never stops its finish.
  const runRef = useRef<RecallRun>({ sessionId: null });
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const restartingRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [answerText, setAnswerText] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [records, setRecords] = useState<QuestionRecord[]>([]);
  const [finished, setFinished] = useState(false);
  // The DB session whose finish succeeded: the results poll its evaluation
  // (Phase 6 T6). Only the current run sets it.
  const [finishedSessionId, setFinishedSessionId] = useState<string | null>(
    null,
  );

  const total = questions.length;
  const progress = total > 0 ? Math.round((index / total) * 100) : 0;
  const question = questions[index];
  const sessionsHref = backHref ?? hubHref("/active-recall", notebookId);

  // Runs `task` after every earlier one; a failure never stops the queue.
  function enqueue(task: () => Promise<void>): Promise<void> {
    const next = queueRef.current.then(task).catch(() => {});
    queueRef.current = next;
    return next;
  }

  async function ensureSession(
    run: RecallRun,
    page: string,
  ): Promise<string | null> {
    if (run.sessionId) return run.sessionId;
    const started = await startRecallSessionAction({ pageId: page });
    if (started.ok) run.sessionId = started.value.sessionId;
    return run.sessionId;
  }

  function persistAnswer(questionId: string, answer: string, rating: number) {
    if (!pageId) return;
    const run = runRef.current;
    enqueue(async () => {
      const sessionId = await ensureSession(run, pageId);
      if (!sessionId) return;
      await saveRecallAnswerAction({
        sessionId,
        questionId,
        answerText: answer,
        selfRating: rating,
      });
    });
  }

  function finish() {
    setFinished(true);
    if (!pageId) return;
    const run = runRef.current;
    enqueue(async () => {
      const sessionId = run.sessionId;
      if (!sessionId) return;
      const closed = await finishRecallSessionAction({ sessionId });
      if (closed.ok && runRef.current === run) {
        setFinishedSessionId(sessionId);
      }
    });
  }

  function completeQuestion(rating: number, answer: string) {
    if (question) {
      persistAnswer(question.id, answer, rating);
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
      finish();
      return;
    }
    setIndex((prev) => prev + 1);
    setPhase("answer");
    setAnswerText("");
    setSubmittedAnswer("");
  }

  function handleSkip() {
    const answer = SKIPPED_ANSWER;
    setSubmittedAnswer(answer);
    completeQuestion(0, answer);
  }

  function handleCalificar() {
    setSubmittedAnswer(answerText.trim() || SKIPPED_ANSWER);
    setPhase("review");
  }

  function reset() {
    setIndex(0);
    setPhase("answer");
    setAnswerText("");
    setSubmittedAnswer("");
    setRecords([]);
    setFinished(false);
    setFinishedSessionId(null);
  }

  // "Nueva sesión": a real session starts a new one (after the previous
  // finish) and shows its questions; if it cannot start, the same
  // questions restart and the next saved answer starts the session.
  function restart() {
    if (!pageId) {
      reset();
      return;
    }
    if (restartingRef.current) return;
    restartingRef.current = true;
    const run: RecallRun = { sessionId: null };
    runRef.current = run;
    enqueue(async () => {
      const started = await startRecallSessionAction({ pageId });
      if (!started.ok) return;
      run.sessionId = started.value.sessionId;
      setQuestions(started.value.questions);
    }).finally(() => {
      restartingRef.current = false;
      reset();
    });
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
        sessionId={finishedSessionId}
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
            Recordación activa — {notebookTitle}
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
            onClick={finish}
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
