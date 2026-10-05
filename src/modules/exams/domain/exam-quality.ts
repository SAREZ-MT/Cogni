// How one exam answer feeds the SM-2 engine (§7.2, user decision
// 2026-10-05). An exam can be taken any time, even with nothing due:
//   wrong            → review with q = 1 (due tomorrow, the page shows in "Hoy")
//   correct and due  → review with q = 4
//   correct, not due → skip: repeated attempts must not inflate the interval
export const EXAM_QUALITY = { wrong: 1, correct: 4 } as const;

export type ExamReviewDecision =
  | { readonly kind: "review"; readonly quality: 1 | 4 }
  | { readonly kind: "skip" };

export function examQualityFor(input: {
  correct: boolean;
  wasDue: boolean;
}): ExamReviewDecision {
  if (!input.correct) return { kind: "review", quality: EXAM_QUALITY.wrong };
  if (input.wasDue) return { kind: "review", quality: EXAM_QUALITY.correct };
  return { kind: "skip" };
}
