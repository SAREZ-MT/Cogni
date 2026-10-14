import { ChartCard } from "@/shared/ui/chart-card";
import { LevelStrip } from "@/shared/ui/level-strip";
import type { MasteryView } from "../_lib/dashboard-view";

// Row 1 (narrow) — "Dominio global" key insight: the current average
// mastery of the pages with items, and a `LevelStrip` (one bar per page
// across every notebook, sorted weakest → strongest). No week-over-week
// change: there is no mastery history (T4 decision 2026-10-13).
export function MasteryInsight({ mastery }: { mastery: MasteryView }) {
  return (
    <div data-testid="mastery-insight">
      <ChartCard
        title="Dominio global"
        ariaLabel="Dominio global: porcentaje de dominio en todos los cuadernos y el nivel de cada página"
        bodyClassName="gap-3"
      >
        <div>
          <p className="font-bold text-[30px] text-fg leading-none">
            {mastery.valuePct === null ? "—" : `${mastery.valuePct}%`}
          </p>
          <p className="mt-1.5 text-[12.5px] text-fg-muted">
            {mastery.valuePct === null
              ? "Aún no hay páginas con ítems"
              : "Promedio de tus páginas con ítems"}
          </p>
        </div>
        <LevelStrip bars={mastery.bars} />
      </ChartCard>
    </div>
  );
}
