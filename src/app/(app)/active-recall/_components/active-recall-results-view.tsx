"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  disagreeRecallAnswerAction,
  getRecallSessionResultsAction,
  type RecallSessionResultsView,
  retryRecallEvaluationAction,
} from "@/modules/active-recall";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { Pill } from "@/shared/ui/pill";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { QuestionFeedbackItem } from "@/shared/ui/question-feedback-item";
import { SectionTitle } from "@/shared/ui/section-header";
import { StatusBanner } from "@/shared/ui/status-banner";
import { cn } from "@/shared/ui/utils";
import {
  type QuestionRecord,
  SELF_RATING_BUCKET_META,
  SELF_RATING_BUCKET_ORDER,
  selfRatingBucketFor,
} from "./self-rating";

export interface ActiveRecallResultsViewProps {
  pageTitle: string;
  records: QuestionRecord[];
  sessionsHref: string;
  onRestart: () => void;
  // The finished DB session (Phase 6 T6): its evaluation is polled until
  // every answer resolved. Without it (design preview, or a session that
  // never started) everything stays in its pending state.
  sessionId?: string | null;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 2500;

function oneDecimal(value: number): string {
  return value.toLocaleString("es-ES", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function answersLabel(count: number): string {
  return `${count} ${count === 1 ? "respuesta" : "respuestas"}`;
}

function sessionDateLabel(results: RecallSessionResultsView | null): string {
  const iso = results?.finishedAt ?? results?.startedAt;
  return (iso ? new Date(iso) : new Date()).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

// Polling is bounded (review part 2 R3-001): each wait grows by half up to
// MAX_POLL_DELAY_MS, and after `maxAttempts` reads still pending (about 9
// minutes by default, beyond the 6-minute claim lease a stuck run needs to
// be taken over) it stops.
export const MAX_POLL_DELAY_MS = 20_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 32;

export function pollDelayMs(attempt: number, baseMs: number): number {
  return Math.min(baseMs * 1.5 ** attempt, MAX_POLL_DELAY_MS);
}

// Failures a later read cannot heal: polling stops at once.
const FINAL_READ_ERRORS = new Set([
  "RECALL_SESSION_NOT_FOUND",
  "RECALL_SESSION_REQUIRED",
  "RECALL_INVALID_INPUT",
]);

// Polls the session's evaluation until it resolves (done or partial); a
// failed read is retried on the next tick. Polling ends on a failure that
// cannot heal or after the last allowed attempt (`stopped`: the view shows
// the error banner with "Reintentar"). `retry` ("Reintentar") requeues the
// failed answers (or reschedules a stuck run) and polls again from scratch.
function useSessionResults(
  sessionId: string | null | undefined,
  intervalMs: number,
  maxAttempts: number,
) {
  const [results, setResults] = useState<RecallSessionResultsView | null>(null);
  const [polling, setPolling] = useState(true);
  const [stopped, setStopped] = useState(false);
  // Bumped by "Reintentar" to restart the polling loop with fresh attempts.
  const [round, setRound] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `round` is a deliberate re-run trigger ("Reintentar" restarts the loop with fresh attempts), not a missing reference.
  useEffect(() => {
    if (!sessionId || !polling) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const tick = async () => {
      const read = await getRecallSessionResultsAction({ sessionId }).catch(
        () => null,
      );
      if (cancelled) return;
      if (read?.ok) {
        setResults(read.value);
        if (read.value.evaluationStatus !== "pending") {
          setPolling(false);
          return;
        }
      } else if (read && FINAL_READ_ERRORS.has(read.error.code)) {
        setPolling(false);
        setStopped(true);
        return;
      }
      attempt += 1;
      if (attempt >= maxAttempts) {
        setPolling(false);
        setStopped(true);
        return;
      }
      timer = setTimeout(tick, pollDelayMs(attempt - 1, intervalMs));
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, polling, intervalMs, maxAttempts, round]);

  const retry = useCallback(async () => {
    if (!sessionId) return;
    setStopped(false);
    setResults((prev) =>
      prev ? { ...prev, evaluationStatus: "pending" } : prev,
    );
    await retryRecallEvaluationAction({ sessionId }).catch(() => null);
    setRound((n) => n + 1);
    setPolling(true);
  }, [sessionId]);

  return { results, stopped, retry };
}

// Active recall's end-of-session results (design/shell-look fix, 2026-09-24;
// documento-maestro §8.5: answers save first, the AI evaluation is async,
// and feedback only shows once every evaluation for the session has
// finished). Rendered in-page by ActiveRecallPlayer instead of the
// Flashcards-style `SessionSummary` overlay, since that overlay has no way
// to represent "still evaluating" — this design preview has no backend to
// ever complete that evaluation, so every section below stays in its
// pending/placeholder state.
//
// Phase 6 T6: with a `sessionId` it runs on real data with the same layout.
// It polls the evaluation; while any answer is pending everything stays
// pending (§8.5: feedback only once every evaluation resolved). Done → the
// banner turns success; partial (a provider failed every attempt) → error
// tone with "Reintentar" — the same banner shows when polling stopped (a
// read that cannot heal, or the attempts ran out). Resolved, the combined-quality and calibration
// blocks show their numbers (no "pronto" badge) and each evaluated
// question fills the approved QuestionFeedbackItem slots (AI score,
// justification) and enables "No estoy de acuerdo", which turns into a
// disabled "Marcado como desacuerdo" once recorded (also on a later read);
// a failed one keeps its pending state until it is retried.
export function ActiveRecallResultsView({
  pageTitle,
  records,
  sessionsHref,
  onRestart,
  sessionId,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
}: ActiveRecallResultsViewProps) {
  const { results, stopped, retry } = useSessionResults(
    sessionId,
    pollIntervalMs,
    maxPollAttempts,
  );
  const resolved =
    results !== null && results.evaluationStatus !== "pending" ? results : null;
  const evaluationByQuestion = new Map(
    (resolved?.answers ?? []).map((answer) => [answer.questionId, answer]),
  );
  const averageCombined = resolved?.averageCombinedQuality ?? null;
  // Answers marked "No estoy de acuerdo" in this view, shown at once; the
  // stored flag (disagreed) keeps them marked on the next read.
  const [markedIds, setMarkedIds] = useState<ReadonlySet<string>>(new Set());
  const setMarked = (answerId: string, marked: boolean) =>
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (marked) next.add(answerId);
      else next.delete(answerId);
      return next;
    });
  const disagree = async (answerId: string) => {
    setMarked(answerId, true);
    const saved = await disagreeRecallAnswerAction({ answerId }).catch(
      () => null,
    );
    if (!saved?.ok) setMarked(answerId, false);
  };
  const answeredCount = records.length;
  const ratingSum = records.reduce((sum, record) => sum + record.selfRating, 0);
  const averageRating = answeredCount > 0 ? ratingSum / answeredCount : 0;
  const averageRatingLabel = oneDecimal(averageRating);

  return (
    <div
      data-testid="active-recall-results"
      className="mx-auto flex w-full max-w-[680px] flex-1 flex-col gap-6 py-8"
    >
      <BackLink href={sessionsHref}>Todas las sesiones</BackLink>

      <div>
        <h1 className="font-bold text-[22px] text-fg">
          Resultados de la sesión
        </h1>
        <p className="mt-1 text-fg-muted text-[13px]">
          {pageTitle} — {answeredCount} preguntas respondidas ·{" "}
          {sessionDateLabel(results)}
        </p>
      </div>

      {resolved?.evaluationStatus === "done" ? (
        <StatusBanner
          data-testid="evaluation-status"
          tone="success"
          title="Evaluación completa"
          description="La IA revisó cada respuesta con la rúbrica de la página."
        />
      ) : resolved?.evaluationStatus === "partial" || stopped ? (
        <StatusBanner
          data-testid="evaluation-status"
          tone="error"
          title="No pudimos evaluar algunas respuestas"
          description="Tus respuestas están guardadas. Vuelve a intentarlo para evaluar las que faltan."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void retry()}
            >
              Reintentar
            </Button>
          }
        />
      ) : (
        <StatusBanner
          data-testid="evaluation-status"
          tone="pending"
          title="Evaluando tus respuestas…"
          description="La IA está revisando cada respuesta con la rúbrica de la página. Te avisaremos cuando termine; puedes volver a esta sesión desde el cuaderno."
        />
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {SELF_RATING_BUCKET_ORDER.map((bucket) => {
          const meta = SELF_RATING_BUCKET_META[bucket];
          const count = records.filter(
            (record) => selfRatingBucketFor(record.selfRating) === bucket,
          ).length;
          return (
            <div key={bucket} className="rounded-lg bg-neutral-100 px-2 py-3.5">
              <p className={cn("font-bold text-[22px]", meta.toneClassName)}>
                {count}
              </p>
              <p className="mt-0.5 text-[11px] text-fg-muted">{meta.label}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-neutral-100 px-4 py-3.5">
        <p className="text-[13px] text-fg-muted">Autoevaluación promedio</p>
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
      </div>

      <div
        data-testid="combined-quality"
        className="rounded-lg bg-neutral-100 px-4 py-3.5"
      >
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-[13px] text-fg">Calidad combinada</p>
          {averageCombined === null && (
            <Pill size="sm" tone="neutral">
              pronto
            </Pill>
          )}
        </div>
        <p className="mt-2 font-bold text-[22px] text-fg">
          {averageCombined === null ? "—" : oneDecimal(averageCombined)} / 5
        </p>
        <p className="mt-1 text-[12px] text-fg-muted">
          0,6 × evaluación de la IA + 0,4 × tu autoevaluación
        </p>
      </div>

      <div className="rounded-lg bg-neutral-100 px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-[13px] text-fg">Calibración</p>
          {!resolved && (
            <Pill size="sm" tone="neutral">
              pronto
            </Pill>
          )}
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-fg-secondary">Exceso de confianza</span>
            <span
              data-testid="calibration-over"
              className="font-semibold text-fg"
            >
              {resolved
                ? answersLabel(resolved.calibration.overconfident)
                : "— respuestas"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-fg-secondary">Falta de confianza</span>
            <span
              data-testid="calibration-under"
              className="font-semibold text-fg"
            >
              {resolved
                ? answersLabel(resolved.calibration.underconfident)
                : "— respuestas"}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-fg-muted">
          Compara lo que sentiste con lo que evaluó la IA.
        </p>
      </div>

      {records.length > 0 && (
        <div>
          <SectionTitle>Retroalimentación por pregunta</SectionTitle>
          <div className="flex flex-col gap-3">
            {records.map((record, recordIndex) => {
              const bucket = selfRatingBucketFor(record.selfRating);
              const meta = SELF_RATING_BUCKET_META[bucket];
              const evaluation = evaluationByQuestion.get(record.id);
              const evaluated = evaluation?.evaluationStatus === "done";
              return (
                <QuestionFeedbackItem
                  key={record.id}
                  index={recordIndex + 1}
                  question={record.prompt}
                  answer={record.answer}
                  selfRating={record.selfRating}
                  selfRatingLabel={meta.label}
                  selfRatingTone={meta.pillTone}
                  pending={!evaluated}
                  aiScore={evaluated ? evaluation.aiScore : null}
                  justification={
                    evaluated ? evaluation.feedback?.justification : undefined
                  }
                  disagreed={
                    evaluated &&
                    (evaluation.disagreed || markedIds.has(evaluation.id))
                  }
                  onDisagree={
                    evaluation ? () => void disagree(evaluation.id) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <Button asChild variant="outline" className="flex-1">
          <Link href={sessionsHref}>Volver a las sesiones</Link>
        </Button>
        <Button
          type="button"
          className="flex-[2] justify-center"
          onClick={onRestart}
        >
          Nueva sesión →
        </Button>
      </div>
    </div>
  );
}
