import { ArrowRight, CircleCheck, Sparkles, Target } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Card } from "@/shared/ui/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { Pill } from "@/shared/ui/pill";

export interface SessionFeedbackContentView {
  summary: string;
  strengths: string[];
  toReinforce: string[];
  nextStepSuggestion: string;
}

export type SessionFeedbackPanelState =
  | { status: "loading" }
  | { status: "done"; content: SessionFeedbackContentView }
  // The AI failed, hit the daily limit or is still answering another
  // request: the session is saved either way (never blocks closing it).
  | { status: "unavailable" };

const TITLE = "Retroalimentación de la sesión";

// One block of the tutor's feedback: its own card, an icon and a label
// over the list. An empty list renders nothing.
function FeedbackList({
  label,
  icon,
  items,
}: {
  label: string;
  icon: ReactNode;
  items: string[];
}) {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <Card className="p-3.5 shadow-none">
      <p
        id={id}
        className="flex items-center gap-1.5 font-semibold text-[13px] text-fg"
      >
        {icon}
        {label}
      </p>
      <ul
        aria-labelledby={id}
        className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] text-fg-secondary leading-[1.55] marker:text-fg-muted"
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}

// The AI session feedback in the summary's feedback slot (documento-maestro
// §3.3: shown at the end of the session, never between cards). It reads as
// a tutor's note (user decision 2026-11-26): the tutor's message first,
// then what the student handled well, the opportunities to improve and the
// next step, each in its own block.
export function SessionFeedbackPanel({
  state,
}: {
  state: SessionFeedbackPanelState;
}) {
  const titleId = useId();
  return (
    <Card
      tone="achievement"
      role="region"
      aria-labelledby={titleId}
      aria-live="polite"
      aria-busy={state.status === "loading"}
      data-testid="session-feedback"
      className="p-4 text-left"
    >
      <div className="flex items-center gap-2.5">
        <IconTile tone="primary" size="36" radius="md">
          <Sparkles aria-hidden="true" size={17} strokeWidth={1.75} />
        </IconTile>
        <p id={titleId} className="font-semibold text-[14px] text-fg">
          {TITLE}
        </p>
        <Pill size="sm" tone="primary">
          IA
        </Pill>
      </div>
      <div className="mt-3">
        {state.status === "loading" && (
          <p className="text-[13px] text-fg-muted">
            Preparando tu retroalimentación…
          </p>
        )}
        {state.status === "unavailable" && (
          <p className="text-[13px] text-fg-muted">
            Esta vez no pudimos preparar la retroalimentación. Tu repaso quedó
            guardado.
          </p>
        )}
        {state.status === "done" && (
          <>
            <p className="text-[14px] text-fg leading-[1.6]">
              {state.content.summary}
            </p>
            <div className="mt-3.5 space-y-2.5">
              <FeedbackList
                label="Lo que dominaste"
                icon={
                  <CircleCheck
                    aria-hidden="true"
                    size={15}
                    strokeWidth={2}
                    className="text-success-600"
                  />
                }
                items={state.content.strengths}
              />
              <FeedbackList
                label="Oportunidades de mejora"
                icon={
                  <Target
                    aria-hidden="true"
                    size={15}
                    strokeWidth={2}
                    className="text-primary-600"
                  />
                }
                items={state.content.toReinforce}
              />
              <div className="rounded-lg border-primary-600 border-l-[3px] bg-card px-3.5 py-3">
                <p className="flex items-center gap-1.5 font-semibold text-[13px] text-primary-600">
                  <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
                  Siguiente paso
                </p>
                <p className="mt-1 text-[13px] text-fg leading-[1.55]">
                  {state.content.nextStepSuggestion}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
