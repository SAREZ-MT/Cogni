"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  type ExamFeedbackView,
  requestExamFeedbackAction,
} from "@/modules/exams";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";

type FeedbackContent = NonNullable<ExamFeedbackView["content"]>;

type PanelState =
  | { status: "loading" }
  | { status: "done"; reused: boolean; content: FeedbackContent }
  // The AI failed, hit the daily limit or another request still holds the
  // row: the exam is saved either way (feedback never blocks closing it).
  | { status: "unavailable" };

function fromView(view: ExamFeedbackView | null): PanelState {
  if (view === null || view.status === "pending") return { status: "loading" };
  if (view.status === "done" && view.content) {
    return { status: "done", reused: view.reused, content: view.content };
  }
  return { status: "unavailable" };
}

function FeedbackList({ label, items }: { label: string; items: string[] }) {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <div className="mt-2.5">
      <p id={id} className="font-medium text-[12px] text-fg">
        {label}
      </p>
      <ul
        aria-labelledby={id}
        className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-fg-secondary"
      >
        {/* Each line once: the model may repeat one. */}
        {[...new Set(items)].map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// The exam's AI feedback on the results screen (documento-maestro §3.3: at
// the end the AI explains the failed questions with the page's content).
// Stored feedback renders at once; with none yet (or a pending row) the
// panel asks requestExamFeedbackAction once and shows a loading state. A
// pass after an earlier pass shows that pass's feedback with a label (user
// decision 2026-10-05). Any failure is a calm note: the exam is saved.
// Same chrome as the flashcards session feedback.
export function ExamFeedbackPanel({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: ExamFeedbackView | null;
}) {
  const titleId = useId();
  const [state, setState] = useState<PanelState>(() => fromView(initial));
  const requested = useRef(false);
  const needsRequest = state.status === "loading";

  useEffect(() => {
    if (!needsRequest || requested.current) return;
    requested.current = true;
    let active = true;
    (async () => {
      let next: PanelState = { status: "unavailable" };
      try {
        const result = await requestExamFeedbackAction({ sessionId });
        if (result.ok) {
          const view = fromView(result.value);
          if (view.status === "done") next = view;
        }
      } catch {
        // Network drop or a crashed action: same calm note.
      }
      if (active) setState(next);
    })();
    return () => {
      active = false;
    };
  }, [needsRequest, sessionId]);

  return (
    <Card
      tone="achievement"
      role="region"
      aria-labelledby={titleId}
      aria-live="polite"
      aria-busy={state.status === "loading"}
      data-testid="exam-feedback"
      className="flex items-start gap-3 p-3.5 text-left"
    >
      <IconTile tone="primary" size="30" radius="md" className="mt-0.5">
        <Sparkles aria-hidden="true" size={15} strokeWidth={1.75} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p id={titleId} className="font-semibold text-[13px] text-fg">
            Retroalimentación con IA
          </p>
          <Pill size="sm" tone="primary">
            IA
          </Pill>
        </div>
        {state.status === "loading" && (
          <p className="mt-1 text-[12px] text-fg-muted">
            Preparando tu retroalimentación…
          </p>
        )}
        {state.status === "unavailable" && (
          <p className="mt-1 text-[12px] text-fg-muted">
            Esta vez no pudimos preparar la retroalimentación. Tu examen quedó
            guardado.
          </p>
        )}
        {state.status === "done" && (
          <>
            {state.reused && (
              <p
                data-testid="exam-feedback-reused"
                className="mt-1 text-[11px] text-fg-muted"
              >
                Retroalimentación de tu último examen aprobado
              </p>
            )}
            <p className="mt-1 text-[12px] text-fg-secondary">
              {state.content.summary}
            </p>
            <FeedbackList
              label="Lo que dominas"
              items={state.content.strengths}
            />
            <FeedbackList
              label="Tus errores, explicados"
              items={state.content.toReinforce}
            />
            <p className="mt-2.5 text-[12px] text-fg-secondary">
              <span className="font-medium text-fg">Siguiente paso: </span>
              {state.content.nextStepSuggestion}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
