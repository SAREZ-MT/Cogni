import Link from "next/link";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { ExamReviewRow } from "@/shared/ui/exam-review-row";
import { Pill } from "@/shared/ui/pill";
import { ScoreCard } from "@/shared/ui/score-card";
import { SectionTitle } from "@/shared/ui/section-header";
import { StatusBanner } from "@/shared/ui/status-banner";
import type { ExamQuestion } from "../_data/sample";

export interface ExamResultsViewProps {
  notebookId: string;
  pageId: string;
  notebookTitle: string;
  pageTitle: string;
  questions: ExamQuestion[];
  answers: Array<number | null>;
  durationSeconds: number;
  // "live": the player just submitted this session in place — "Nuevo
  // examen" restarts locally (`onRestart`, required). "stored": rendering
  // a past session from sample data (exams/[notebookId]/[pageId]/
  // resultados) — "Nuevo examen" links to a fresh session instead.
  mode: "live" | "stored";
  // Preformatted date the session was presented on (stored mode only).
  date?: string;
  isRetake?: boolean;
  onRestart?: () => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
const PASSING_SCORE = 70;

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(clamped / 60)).padStart(2, "0");
  const seconds = String(clamped % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// Exam's end-of-session results (design preview, in place — not an
// overlay, same reasoning as ActiveRecallResultsView — documento-maestro
// §7.5: score = correct / total; below 70 % the page is marked
// `retake_pending` and the failed questions are rescheduled for tomorrow;
// AI feedback explaining the failed questions arrives async, so its
// section always renders pending in this backend-less preview).
//
// Reused for stored past sessions since 2026-09-24 (exams/[notebookId]/
// [pageId]/resultados/page.tsx, documento-maestro §3.3): `mode` switches
// the closing action between a local restart and a plain link to a new
// session, and an "Editar preguntas" outline action was added for the new
// manual question-management screen.
export function ExamResultsView({
  notebookId,
  pageId,
  notebookTitle,
  pageTitle,
  questions,
  answers,
  durationSeconds,
  mode,
  date,
  isRetake = false,
  onRestart,
}: ExamResultsViewProps) {
  const total = questions.length;
  const correctCount = questions.filter(
    (question, index) => answers[index] === question.correctIndex,
  ).length;
  const unansweredCount = answers.filter((answer) => answer === null).length;
  const incorrectCount = total - correctCount - unansweredCount;
  const score = total > 0 ? Math.floor((correctCount * 100) / total) : 0;
  // documento-maestro §7.5 grades the raw ratio (`score < 0.70` retakes), so
  // compare in integers: the rounded `score` above is display-only and would
  // pass 23/33 (69.7 %) as 70.
  const passed = total > 0 && correctCount * 100 >= PASSING_SCORE * total;
  const sessionsHref = `/exams/${notebookId}`;
  const newSessionHref = `/exams/${notebookId}/${pageId}`;
  const questionsHref = `/exams/${notebookId}/${pageId}/preguntas`;

  return (
    <div
      data-testid="exam-results"
      className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 py-8"
    >
      <BackLink href={sessionsHref}>Todos los exámenes</BackLink>

      {(date || isRetake) && (
        <div className="-mb-3 flex flex-wrap items-center gap-2">
          {date && (
            <p className="text-fg-muted text-xs">Presentado el {date}</p>
          )}
          {isRetake && (
            <Pill size="sm" tone="rose">
              Examen de repetición
            </Pill>
          )}
        </div>
      )}

      <ScoreCard
        score={score}
        correct={correctCount}
        incorrect={incorrectCount}
        unanswered={unansweredCount}
        total={total}
        timeLabel={formatTime(durationSeconds)}
        pageTitle={pageTitle}
        notebookTitle={notebookTitle}
      />

      {passed ? (
        <StatusBanner
          tone="success"
          title="Aprobado"
          description="Superaste el 70 %. La página queda al día."
        />
      ) : (
        <StatusBanner
          tone="rose"
          title="Nota menor a 70 %"
          description="La página queda marcada para repetir el examen. Las preguntas falladas vencen mañana y aparecerán en Hoy."
          action={
            <Button
              asChild
              size="sm"
              className="bg-pastel-pink-fg text-white hover:bg-pastel-pink-fg"
            >
              <Link href={`/exams/${notebookId}/${pageId}?retake=1`}>
                Repetir examen
              </Link>
            </Button>
          }
        />
      )}

      <StatusBanner
        data-testid="feedback-status"
        tone="pending"
        title="Preparando la retroalimentación…"
        description="La IA explicará las preguntas falladas usando el contenido de la página."
      />

      <div>
        <SectionTitle>Revisión pregunta por pregunta</SectionTitle>
        <div className="flex flex-col gap-3">
          {questions.map((question, index) => {
            const selected = answers[index];
            const status =
              selected === null
                ? "unanswered"
                : selected === question.correctIndex
                  ? "correct"
                  : "incorrect";
            const yourAnswerLabel =
              selected === null
                ? "Sin responder"
                : `${OPTION_LETTERS[selected]}) ${question.options[selected]}`;
            const correctAnswerLabel = `${OPTION_LETTERS[question.correctIndex]}) ${question.options[question.correctIndex]}`;

            return (
              <ExamReviewRow
                key={question.id}
                index={index + 1}
                stem={question.stem}
                status={status}
                concept={question.concept}
                yourAnswerLabel={yourAnswerLabel}
                correctAnswerLabel={correctAnswerLabel}
                explanationPending={status !== "correct"}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button asChild variant="outline" className="min-w-[150px] flex-1">
          <Link href={sessionsHref}>Volver a los exámenes</Link>
        </Button>
        <Button asChild variant="outline" className="min-w-[150px] flex-1">
          <Link href={questionsHref}>Editar preguntas</Link>
        </Button>
        {mode === "stored" ? (
          <Button asChild className="min-w-[170px] flex-[2] justify-center">
            <Link href={newSessionHref}>Nuevo examen →</Link>
          </Button>
        ) : (
          <Button
            type="button"
            className="min-w-[170px] flex-[2] justify-center"
            onClick={onRestart}
          >
            Nuevo examen →
          </Button>
        )}
      </div>
    </div>
  );
}
