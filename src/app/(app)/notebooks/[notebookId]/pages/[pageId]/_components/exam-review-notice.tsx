"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Pill } from "@/shared/ui/pill";
import { StatusBanner } from "@/shared/ui/status-banner";

export interface ExamReviewNoticeProps {
  // The current concepts of the roots failed in the last failed exam.
  failedConcepts: string[];
  // The page's exam route, where the retake starts.
  examHref: string;
}

// Review before retaking (user decision 2026-10-05): while the page waits
// for a retake, the page shows the failed concepts and a "Repetir examen"
// action, so the student reviews the content first. The route renders it
// from the page's exam state (getExamReviewNoticeAction), never from the
// "Repasar contenido" link's query alone; "Ocultar" hides it for this visit
// only.
export function ExamReviewNotice({
  failedConcepts,
  examHref,
}: ExamReviewNoticeProps) {
  const [dismissed, setDismissed] = useState(false);
  const listId = useId();
  if (dismissed) return null;

  return (
    <StatusBanner
      role="region"
      aria-label="Repasa antes de repetir el examen"
      data-testid="exam-review-notice"
      tone="rose"
      title="Repasa antes de repetir el examen"
      description="Fallaste estos conceptos en tu último examen. Repásalos en esta página y luego repite el examen con preguntas reformuladas."
      action={
        <div className="flex flex-col gap-2.5">
          <span id={listId} className="sr-only">
            Conceptos fallados
          </span>
          <ul aria-labelledby={listId} className="flex flex-wrap gap-1.5">
            {failedConcepts.map((concept) => (
              <li key={concept}>
                <Pill size="sm" tone="rose">
                  {concept}
                </Pill>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href={examHref} data-testid="review-notice-retake-link">
                Repetir examen
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Ocultar aviso"
              onClick={() => setDismissed(true)}
            >
              <X aria-hidden="true" size={14} strokeWidth={1.75} />
              Ocultar
            </Button>
          </div>
        </div>
      }
    />
  );
}
