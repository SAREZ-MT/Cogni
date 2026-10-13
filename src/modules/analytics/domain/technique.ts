// The three study techniques as review_logs.session_kind names them
// (mirror of study-engine's SessionKind, checked at compile time in
// application/get-technique-metrics.ts), in the techniques panel order.
export const ANALYTICS_TECHNIQUES = ["flashcards", "recall", "exam"] as const;

export type Technique = (typeof ANALYTICS_TECHNIQUES)[number];

export type TechniqueCounts = Record<Technique, number>;

export function emptyTechniqueCounts(): TechniqueCounts {
  return { flashcards: 0, recall: 0, exam: 0 };
}
