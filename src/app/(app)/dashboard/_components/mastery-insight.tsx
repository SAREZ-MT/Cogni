import { ArrowDown, ArrowUp } from "lucide-react";
import { ChartCard } from "@/shared/ui/chart-card";
import { LevelStrip } from "@/shared/ui/level-strip";
import { dominioGlobalInsight } from "../_data/sample";

// Row 1 (narrow) — "Dominio global" key insight: a big percentage, its
// week-over-week delta, and a `LevelStrip` (one bar per page across every
// notebook, sorted weakest → strongest).
export function MasteryInsight() {
  const { valuePct, deltaPts, bars } = dominioGlobalInsight();
  const isUp = deltaPts >= 0;
  const DeltaIcon = isUp ? ArrowUp : ArrowDown;

  return (
    <div data-testid="mastery-insight">
      <ChartCard
        title="Dominio global"
        ariaLabel="Dominio global: porcentaje de dominio en todos los cuadernos y su tendencia por página"
        bodyClassName="gap-3"
      >
        <div>
          <p className="font-bold text-[30px] text-fg leading-none">
            {valuePct}%
          </p>
          <p
            className={
              isUp
                ? "mt-1.5 flex items-center gap-1 text-[12.5px] text-success-600"
                : "mt-1.5 flex items-center gap-1 text-[12.5px] text-error-600"
            }
          >
            <DeltaIcon aria-hidden="true" size={13} strokeWidth={2.5} />
            {Math.abs(deltaPts)} pts vs la semana pasada
          </p>
        </div>
        <LevelStrip bars={bars} />
      </ChartCard>
    </div>
  );
}
