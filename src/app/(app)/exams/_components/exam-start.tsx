"use client";

import { FileCheck, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  EXAM_DEFAULT_QUESTIONS,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_QUESTIONS,
  startExamSessionAction,
} from "@/modules/exams";
import { BackLink } from "@/shared/ui/back-link";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { CountStepper } from "@/shared/ui/count-stepper";
import { IconTile } from "@/shared/ui/icon-tile";
import { StatusBanner } from "@/shared/ui/status-banner";

const START_FAILURE = "No pudimos iniciar el examen. Intenta de nuevo.";

// Spanish copy per ActionError code of startExamSessionAction.
const ERROR_COPY: Record<string, string> = {
  EXAMS_NOT_ENOUGH_QUESTIONS: `Esta página necesita al menos ${EXAM_MIN_QUESTIONS} preguntas para rendir un examen.`,
  EXAMS_RETAKE_PENDING:
    "Esta página tiene una repetición pendiente. La repetición con preguntas nuevas llega pronto.",
  EXAMS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
  PAGE_NOT_FOUND: "Esta página ya no existe.",
};

export interface ExamStartProps {
  pageTitle: string;
  pageHref: string;
  pageId: string;
  questionsHref: string;
  // Roots with an active question on the page.
  activeQuestionCount: number;
  retakePending: boolean;
  // Results of the page's last finished exam, when there is one.
  lastResultsHref: string | null;
}

// Start of a page's exam (documento-maestro §3.3: N questions, 10 by
// default; user decision 2026-10-05: N from 10 to 30). "Comenzar examen"
// opens the session through startExamSessionAction and refreshes the route,
// which then renders the player for the page's open session. A page with
// fewer than 10 questions or a pending retake cannot start one here.
export function ExamStart({
  pageTitle,
  pageHref,
  pageId,
  questionsHref,
  activeQuestionCount,
  retakePending,
  lastResultsHref,
}: ExamStartProps) {
  const router = useRouter();
  // The stepper never offers more questions than the page has (the exam
  // would hold min(N, questions) anyway), within 10-30.
  const max = Math.max(
    EXAM_MIN_QUESTIONS,
    Math.min(EXAM_MAX_QUESTIONS, activeQuestionCount),
  );
  const [count, setCount] = useState(Math.min(EXAM_DEFAULT_QUESTIONS, max));
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const enough = activeQuestionCount >= EXAM_MIN_QUESTIONS;

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startExamSessionAction({ pageId, count });
        if (!result.ok) {
          setError(ERROR_COPY[result.error.code] ?? START_FAILURE);
          return;
        }
      } catch {
        setError(START_FAILURE);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      data-testid="exam-start"
      className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5 py-8"
    >
      <BackLink href={pageHref}>Volver a la página</BackLink>

      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <IconTile size="56" tone="pink">
          <FileCheck aria-hidden="true" size={28} strokeWidth={1.75} />
        </IconTile>
        <div>
          <h1 className="font-bold text-[20px] text-fg">
            Examen — {pageTitle}
          </h1>
          <p className="mt-1 text-fg-muted text-sm">
            Preguntas de opción múltiple sobre esta página. Verás si acertaste
            después de cada respuesta.
          </p>
        </div>

        {retakePending ? (
          <StatusBanner
            data-testid="exam-retake-soon"
            tone="rose"
            title="Repetir examen (próximamente)"
            description="Fallaste el último examen de esta página. Pronto podrás repetirlo con preguntas nuevas sobre los conceptos que fallaste."
            action={
              lastResultsHref ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={lastResultsHref}>Ver resultados</Link>
                </Button>
              ) : undefined
            }
          />
        ) : enough ? (
          <>
            <CountStepper
              label="Preguntas del examen"
              value={count}
              min={EXAM_MIN_QUESTIONS}
              max={max}
              onChange={setCount}
              disabled={starting}
              testId="exam-session-count"
              className="w-full max-w-[280px]"
            />
            <Button
              type="button"
              onClick={start}
              disabled={starting}
              data-testid="start-exam-button"
              className="min-w-[200px]"
            >
              <Play aria-hidden="true" size={15} strokeWidth={2} />
              {starting ? "Preparando…" : "Comenzar examen"}
            </Button>
          </>
        ) : (
          <StatusBanner
            data-testid="exam-not-enough"
            tone="pending"
            title={`Necesitas al menos ${EXAM_MIN_QUESTIONS} preguntas`}
            description={`Esta página tiene ${activeQuestionCount}. Agrega o genera más para rendir un examen.`}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={questionsHref}>Ver preguntas</Link>
              </Button>
            }
          />
        )}

        {error && (
          <p
            role="alert"
            data-testid="exam-start-error"
            className="text-[13px] text-error-600"
          >
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
