import { ChartCard } from "@/shared/ui/chart-card";
import { ConceptBarList } from "@/shared/ui/concept-bar-list";
import { conceptStrengths, conceptWeaknesses } from "../_data/sample";

// Row 9 — "Fortalezas" / "Puntos débiles": two `ConceptBarList`s side by
// side, top 5 each (unchanged from v1).
export function Concepts() {
  const strengths = conceptStrengths();
  const weaknesses = conceptWeaknesses();

  return (
    <div
      data-testid="concepts"
      className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
    >
      <ChartCard
        title="Fortalezas"
        description="Los 5 conceptos con mejor desempeño."
        ariaLabel="Fortalezas: conceptos con mejor desempeño"
      >
        {strengths.length > 0 ? (
          <ConceptBarList items={strengths} tone="success" />
        ) : (
          <p className="text-[12.5px] text-fg-muted">Sin datos todavía.</p>
        )}
      </ChartCard>
      <ChartCard
        title="Puntos débiles"
        description="Los 5 conceptos que más necesitan repaso."
        ariaLabel="Puntos débiles: conceptos que más necesitan repaso"
      >
        {weaknesses.length > 0 ? (
          <ConceptBarList items={weaknesses} tone="error" />
        ) : (
          <p className="text-[12.5px] text-fg-muted">Sin datos todavía.</p>
        )}
      </ChartCard>
    </div>
  );
}
