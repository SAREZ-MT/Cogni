import Link from "next/link";
import type { ExamResultsView as ExamResults } from "@/modules/exams";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { ExamReviewRow } from "@/shared/ui/exam-review-row";
import { Pill } from "@/shared/ui/pill";
import { ScoreCard } from "@/shared/ui/score-card";
import { SectionTitle } from "@/shared/ui/section-header";
import { StatusBanner } from "@/shared/ui/status-banner";

export interface ExamResultsViewProps {
  notebookTitle: string;
  pageTitle: string;
  pageHref: string;
  questionsHref: string;
  examHref: string;
  results: ExamResults;
}

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(clamped / 60)).padStart(2, "0");
  const seconds = String(clamped % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function optionLabel(options: string[], index: number): string {
  return `${OPTION_LETTERS[index] ?? "?"}) ${options[index] ?? ""}`;
}

// A finished exam's results on real data (documento-maestro §7.5: score =
// correct / total; below 70 % the page waits for a retake and the failed
// questions are due tomorrow). Shows the score, the total time taken (user
// decision 2026-10-05: the only place besides the player a time metric is
// shown), the failed concepts and every question with its explanation.
// "Repetir examen" opens the page's exam route, where the retake with
// reformulated questions starts (T7); the AI feedback and "Repasar
// contenido" (T8) are placeholders until their task ships.
export function ExamResultsView({
  notebookTitle,
  pageTitle,
  pageHref,
  questionsHref,
  examHref,
  results,
}: ExamResultsViewProps) {
  const incorrect = results.total - results.correct;

  return (
    <div
      data-testid="exam-results"
      className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 py-8"
    >
      <BackLink href={pageHref}>Volver a la página</BackLink>

      <ScoreCard
        score={results.scorePercent}
        correct={results.correct}
        incorrect={incorrect}
        unanswered={0}
        total={results.total}
        timeLabel={formatTime(results.durationSeconds)}
        pageTitle={pageTitle}
        notebookTitle={notebookTitle}
      />

      {results.passed ? (
        <StatusBanner
          data-testid="exam-passed"
          tone="success"
          title="Aprobado"
          description="Superaste el 70 %. La página queda al día."
        />
      ) : (
        <StatusBanner
          data-testid="exam-failed"
          tone="rose"
          title="Nota menor a 70 %"
          description="La página queda marcada para repetir el examen. Las preguntas falladas vencen mañana y aparecerán en Hoy."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <Link href={examHref} data-testid="retake-exam-link">
                  Repetir examen
                </Link>
              </Button>
              <Button size="sm" variant="outline" disabled>
                Repasar contenido · pronto
              </Button>
            </div>
          }
        />
      )}

      {results.failedConcepts.length > 0 && (
        <div data-testid="exam-failed-concepts">
          <SectionTitle>Conceptos a reforzar</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {results.failedConcepts.map((concept) => (
              <Pill key={concept} size="sm" tone="rose">
                {concept}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <StatusBanner
        data-testid="feedback-status"
        tone="pending"
        title="Retroalimentación con IA · pronto"
        description="Pronto la IA explicará tus errores usando el contenido de la página."
      />

      <div>
        <SectionTitle>Revisión pregunta por pregunta</SectionTitle>
        <div className="flex flex-col gap-3">
          {results.questions.map((question, index) => (
            <ExamReviewRow
              key={question.id}
              index={index + 1}
              stem={question.stem}
              status={question.isCorrect ? "correct" : "incorrect"}
              concept={question.concept}
              yourAnswerLabel={optionLabel(
                question.options,
                question.selectedIndex,
              )}
              correctAnswerLabel={optionLabel(
                question.options,
                question.correctIndex,
              )}
              explanationPending={false}
              explanation={question.explanation}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button asChild variant="outline" className="min-w-[150px] flex-1">
          <Link href={pageHref}>Volver a la página</Link>
        </Button>
        <Button asChild variant="outline" className="min-w-[150px] flex-1">
          <Link href={questionsHref}>Editar preguntas</Link>
        </Button>
        {results.passed && (
          <Button asChild className="min-w-[170px] flex-[2] justify-center">
            <Link href={examHref} data-testid="new-exam-link">
              Nuevo examen →
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
