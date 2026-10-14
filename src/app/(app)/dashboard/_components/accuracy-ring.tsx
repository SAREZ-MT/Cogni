import { ArrowDown, ArrowUp, Target } from "lucide-react";
import { ChartCard } from "@/shared/ui/chart-card";
import { DashedRing } from "@/shared/ui/dashed-ring";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import type { AccuracyView, TechniqueAccuracy } from "../_lib/dashboard-view";

function AccuracyDelta({ deltaPts }: { deltaPts: number | null }) {
  if (deltaPts === null) return null;
  const isUp = deltaPts >= 0;
  const DeltaIcon = isUp ? ArrowUp : ArrowDown;
  return (
    <span
      className={
        isUp
          ? "flex items-center gap-0.5 text-success-600"
          : "flex items-center gap-0.5 text-error-600"
      }
    >
      <DeltaIcon aria-hidden="true" size={11} strokeWidth={2.5} />
      {Math.abs(deltaPts)}
    </span>
  );
}

function TechniqueRow({ technique }: { technique: TechniqueAccuracy }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[12.5px] text-fg">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${technique.dotClass}`}
        />
        {technique.label}
      </span>
      <span className="flex items-center gap-2 text-[12.5px]">
        <span className="font-semibold text-fg tabular-nums">
          {technique.accuracyPct === null ? "—" : `${technique.accuracyPct}%`}
        </span>
        <AccuracyDelta deltaPts={technique.deltaPts} />
      </span>
    </li>
  );
}

// Row 3 (narrow) — "Tasa de acierto": the overall accuracy (correct over
// total outcomes across techniques) inside a dashed ring, plus a per-
// technique breakdown row with deltas (percentage points) vs. the previous
// period. Without any outcome in the period it shows an empty state.
export function AccuracyRing({
  accuracy: { overallPct, techniques },
}: {
  accuracy: AccuracyView;
}) {
  return (
    <div data-testid="accuracy-ring">
      <ChartCard
        icon={
          <IconTile size="36" radius="input" tone="neutral">
            <Target aria-hidden="true" size={16} strokeWidth={1.75} />
          </IconTile>
        }
        title="Tasa de acierto"
        divider
        ariaLabel="Tasa de acierto general y por técnica"
        bodyClassName="items-center gap-5"
      >
        {overallPct === null ? (
          <EmptyState
            variant="plain"
            fill
            icon={
              <IconTile size="36" radius="tile" tone="neutral">
                <Target aria-hidden="true" size={16} strokeWidth={1.75} />
              </IconTile>
            }
            title="Aún sin resultados"
            titleAs="p"
            titleClassName="text-[13px]"
            description="Repasa flashcards, responde preguntas o termina un examen para ver tu tasa de acierto."
            descriptionClassName="text-[12px]"
          />
        ) : (
          <>
            <DashedRing
              value={overallPct}
              label="Tasa de acierto"
              icon={
                <IconTile size="30" radius="tile" tone="primary">
                  <Target aria-hidden="true" size={14} strokeWidth={1.75} />
                </IconTile>
              }
            />
            <ol className="flex w-full flex-col gap-2">
              {techniques.map((technique) => (
                <TechniqueRow key={technique.key} technique={technique} />
              ))}
            </ol>
          </>
        )}
      </ChartCard>
    </div>
  );
}
