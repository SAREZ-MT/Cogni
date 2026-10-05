import { Sparkles } from "lucide-react";
import { useId } from "react";
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
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// The AI session feedback in the summary's feedback slot (documento-maestro
// §3.3: shown at the end of the session, never between cards). Same chrome
// as the summary's placeholder: a Sparkles IconTile and the fixed title.
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
      className="flex items-start gap-3 p-3.5 text-left"
    >
      <IconTile tone="primary" size="30" radius="md" className="mt-0.5">
        <Sparkles aria-hidden="true" size={15} strokeWidth={1.75} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p id={titleId} className="font-semibold text-[13px] text-fg">
            {TITLE}
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
            Esta vez no pudimos preparar la retroalimentación. Tu repaso quedó
            guardado.
          </p>
        )}
        {state.status === "done" && (
          <>
            <p className="mt-1 text-[12px] text-fg-secondary">
              {state.content.summary}
            </p>
            <FeedbackList
              label="Lo que recordaste bien"
              items={state.content.strengths}
            />
            <FeedbackList
              label="Conviene reforzar"
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
