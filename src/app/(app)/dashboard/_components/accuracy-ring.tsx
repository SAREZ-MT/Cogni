import { ArrowDown, ArrowUp, Target } from "lucide-react";
import { ChartCard } from "@/shared/ui/chart-card";
import { DashedRing } from "@/shared/ui/dashed-ring";
import { IconTile } from "@/shared/ui/icon-tile";
import { accuracyRingInsight } from "../_data/sample";

// Row 3 (narrow) — "Tasa de acierto": the overall accuracy (weighted by
// review volume across techniques) inside a dashed ring, plus a per-
// technique breakdown row with deltas vs. la semana pasada.
export function AccuracyRing() {
  const { overallPct, techniques } = accuracyRingInsight();

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
          {techniques.map((technique) => {
            const isUp = technique.accuracyDeltaPts >= 0;
            const DeltaIcon = isUp ? ArrowUp : ArrowDown;
            return (
              <li
                key={technique.key}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 text-[12.5px] text-fg">
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${technique.dotClass}`}
                  />
                  {technique.label}
                </span>
                <span className="flex items-center gap-2 text-[12.5px]">
                  <span className="font-semibold text-fg tabular-nums">
                    {technique.accuracyPct}%
                  </span>
                  <span
                    className={
                      isUp
                        ? "flex items-center gap-0.5 text-success-600"
                        : "flex items-center gap-0.5 text-error-600"
                    }
                  >
                    <DeltaIcon aria-hidden="true" size={11} strokeWidth={2.5} />
                    {Math.abs(technique.accuracyDeltaPts)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </ChartCard>
    </div>
  );
}
