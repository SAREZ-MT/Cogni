import { Brain, FileCheck, Target } from "lucide-react";
import Link from "next/link";
import type { WeakTopic } from "@/modules/analytics";
import { IconTile } from "@/shared/ui/icon-tile";
import { ProgressBar } from "@/shared/ui/progress-bar";
import { cn } from "@/shared/ui/utils";
import { toTone } from "../../calendario/_lib/today-rows";
import { NOTEBOOK_DOT_CLASSES } from "../notebook-swatches";

// Two severities, so the colour adds meaning instead of noise: under 40%
// correct is red, the rest of the weak range (40–69%) is amber. The % is
// always written next to the bar, so colour is never the only signal.
export function accuracySeverity(accuracy: number): "high" | "medium" {
  return accuracy < 0.4 ? "high" : "medium";
}

const SEVERITY_CLASS = {
  high: { text: "text-error-600", fill: "bg-error-500" },
  medium: { text: "text-warning-700", fill: "bg-warning-500" },
} as const;

// Empty state art: a target with the two techniques that feed it (recall
// and exams) tucked at its sides, built from IconTiles, not an image.
function EmptyArt() {
  return (
    <div aria-hidden="true" className="relative h-16 w-32 shrink-0">
      <IconTile
        size="40"
        radius="input"
        tone="mint"
        className="-rotate-12 absolute top-5 left-0 shadow-xs"
      >
        <Brain size={18} strokeWidth={1.75} />
      </IconTile>
      <IconTile
        size="40"
        radius="input"
        tone="pink"
        className="absolute top-5 right-0 rotate-12 shadow-xs"
      >
        <FileCheck size={18} strokeWidth={1.75} />
      </IconTile>
      <IconTile
        size="52"
        radius="tile"
        tone="neutral"
        className="absolute top-0 left-1/2 -translate-x-1/2 border border-border-subtle bg-card shadow-sm"
      >
        <Target size={24} strokeWidth={1.75} />
      </IconTile>
    </div>
  );
}

// Home's "Temas débiles" (Phase 8 H2-T5e): the pages with the lowest
// accuracy in active recall and exams over the last 30 days (analytics
// getHomeWeakTopics), worst first, each a link to the page. Since H2-T5j it
// sits last in the wide main column: a two-column list from sm and a
// compact one-line empty state; empty and failed reads keep the card.
export function WeakTopics({
  topics,
  className,
}: {
  topics: WeakTopic[] | null;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="home-weak-title"
      className={cn(
        "flex flex-col rounded-xl border border-border-subtle bg-card p-5 shadow-xs",
        className,
      )}
    >
      <h2
        id="home-weak-title"
        className="font-semibold text-[17px] text-fg tracking-[-0.01em]"
      >
        Temas débiles
      </h2>
      <p className="mt-1 text-[13px] text-fg-secondary">
        Lo que más te cuesta en los últimos 30 días.
      </p>
      {topics === null ? (
        <p role="alert" className="mt-5 text-[13px] text-fg-secondary">
          No pudimos cargar tus temas débiles.
        </p>
      ) : topics.length === 0 ? (
        <div
          data-part="empty"
          className="mt-4 flex flex-row items-center gap-4 rounded-lg bg-neutral-50 px-4 py-3"
        >
          <EmptyArt />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-semibold text-[15px] text-fg">
              Aún no hay temas débiles
            </p>
            <p className="text-[13px] text-fg-secondary">
              Aparecen cuando practiques recordación activa o exámenes.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {topics.map((topic) => {
            const percent = Math.round(topic.accuracy * 100);
            const severity = SEVERITY_CLASS[accuracySeverity(topic.accuracy)];
            return (
              <li key={topic.pageId}>
                <Link
                  href={`/notebooks/${topic.notebookId}/pages/${topic.pageId}`}
                  className="-mx-2 flex flex-col gap-1.5 rounded-input px-2 py-2.5 no-underline outline-none transition-colors hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold text-[14px] text-fg">
                      {topic.pageTitle}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold text-[13px] tabular-nums",
                        severity.text,
                      )}
                    >
                      {percent}%
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-fg-secondary">
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 rounded-full ${NOTEBOOK_DOT_CLASSES[toTone(topic.notebookColor)]}`}
                    />
                    <span className="truncate">{topic.notebookTitle}</span>
                  </span>
                  <ProgressBar
                    value={percent}
                    aria-label={`${percent}% de acierto en ${topic.attempts} respuestas`}
                    fillClassName={severity.fill}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
