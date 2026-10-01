import Link from "next/link";
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
}

// Active recall's end-of-session results (design/shell-look fix, 2026-09-24;
// documento-maestro §8.5: answers save first, the AI evaluation is async,
// and feedback only shows once every evaluation for the session has
// finished). Rendered in-page by ActiveRecallPlayer instead of the
// Flashcards-style `SessionSummary` overlay, since that overlay has no way
// to represent "still evaluating" — this design preview has no backend to
// ever complete that evaluation, so every section below stays in its
// pending/placeholder state.
export function ActiveRecallResultsView({
  pageTitle,
  records,
  sessionsHref,
  onRestart,
}: ActiveRecallResultsViewProps) {
  const answeredCount = records.length;
  const ratingSum = records.reduce((sum, record) => sum + record.selfRating, 0);
  const averageRating = answeredCount > 0 ? ratingSum / answeredCount : 0;
  const averageRatingLabel = averageRating.toLocaleString("es-ES", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });

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
          {pageTitle} — {answeredCount} preguntas respondidas · 24 sept
        </p>
      </div>

      <StatusBanner
        data-testid="evaluation-status"
        tone="pending"
        title="Evaluando tus respuestas…"
        description="La IA está revisando cada respuesta con la rúbrica de la página. Te avisaremos cuando termine; puedes volver a esta sesión desde el cuaderno."
      />

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

      <div className="rounded-lg bg-neutral-100 px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-[13px] text-fg">Calidad combinada</p>
          <Pill size="sm" tone="neutral">
            pronto
          </Pill>
        </div>
        <p className="mt-2 font-bold text-[22px] text-fg">— / 5</p>
        <p className="mt-1 text-[12px] text-fg-muted">
          0,6 × evaluación de la IA + 0,4 × tu autoevaluación
        </p>
      </div>

      <div className="rounded-lg bg-neutral-100 px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-[13px] text-fg">Calibración</p>
          <Pill size="sm" tone="neutral">
            pronto
          </Pill>
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-fg-secondary">Exceso de confianza</span>
            <span className="font-semibold text-fg">— respuestas</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-fg-secondary">Falta de confianza</span>
            <span className="font-semibold text-fg">— respuestas</span>
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
              return (
                <QuestionFeedbackItem
                  key={record.id}
                  index={recordIndex + 1}
                  question={record.prompt}
                  answer={record.answer}
                  selfRating={record.selfRating}
                  selfRatingLabel={meta.label}
                  selfRatingTone={meta.pillTone}
                  pending
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
