// Shared page-mastery vocabulary (documento-maestro §7.3: Nuevo "sin
// ítems", Aprendiendo <0.35, Consolidando <0.70, Dominado ≥0.70) consumed by
// every dashboard chart atom that renders a mastery level as a colour
// (`StackedLevelBar`, `MasteryHeatmap`) or that needs to derive one from a
// raw score (`_data/sample.ts`). Centralized here instead of duplicated in
// each atom so the four-tone palette and thresholds can never drift apart.
export type MasteryLevel =
  | "nuevo"
  | "aprendiendo"
  | "consolidando"
  | "dominado";

// Fixed order (Nuevo → Dominado) every stacked bar / legend renders in.
export const MASTERY_LEVELS: readonly MasteryLevel[] = [
  "nuevo",
  "aprendiendo",
  "consolidando",
  "dominado",
];

export const MASTERY_LEVEL_LABEL: Record<MasteryLevel, string> = {
  nuevo: "Nuevo",
  aprendiendo: "Aprendiendo",
  consolidando: "Consolidando",
  dominado: "Dominado",
};

// Single solid-tone palette (visual review fix: the heatmap used to render
// a light tint while the stacked bar rendered a saturated 500 for the same
// level — same colour EVERYWHERE now, so a level reads identically in the
// heatmap, the stacked bar and the legend). Nuevo stays a light neutral
// (there's no "Nuevo-500" that would read as a colour rather than an
// absence of one) with a slightly darker border for definition; the other
// three are the plain 500-weight token.
export const MASTERY_LEVEL_SOLID_CLASS: Record<MasteryLevel, string> = {
  nuevo: "bg-neutral-200 border border-neutral-300",
  aprendiendo: "bg-warning-500",
  consolidando: "bg-info-500",
  dominado: "bg-success-500",
};

// documento-maestro §7.3 thresholds: a page with no items is "Nuevo"
// regardless of score; otherwise the score alone decides the band.
export function masteryLevelFromScore(
  score: number,
  itemsTotal: number,
): MasteryLevel {
  if (itemsTotal === 0) return "nuevo";
  if (score < 0.35) return "aprendiendo";
  if (score < 0.7) return "consolidando";
  return "dominado";
}
