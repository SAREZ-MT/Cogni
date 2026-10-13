// Metacognitive calibration (§3.6, §7.4, ADR 0007), recall only: the only
// technique with both a self-assessment and an objective score. The signal
// of each answer comes from active-recall's calibrationOf (classified in
// the application layer, never re-implemented here); this rolls the
// signals up per page. Derived on every read, never stored.

// Mirror of active-recall's Calibration, checked at compile time in
// application/get-calibration.ts.
export type CalibrationSignal =
  | "overconfident"
  | "underconfident"
  | "calibrated";

export interface CalibratedAnswer {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  selfRating: number;
  aiScore: number;
  signal: CalibrationSignal;
}

export interface CalibrationCounts {
  answers: number;
  overconfident: number;
  underconfident: number;
  calibrated: number;
}

export interface PageCalibration extends CalibrationCounts {
  pageId: string;
  pageTitle: string;
  notebookId: string;
  notebookTitle: string;
  // Average self-rating and AI score (0–5) of the page's answers.
  selfAverage: number;
  aiAverage: number;
}

export interface CalibrationRollup {
  // The pages with the largest share of miscalibrated answers first; ties
  // keep the order of each page's first answer.
  pages: PageCalibration[];
  totals: CalibrationCounts;
}

function emptyCounts(): CalibrationCounts {
  return { answers: 0, overconfident: 0, underconfident: 0, calibrated: 0 };
}

function miscalibratedShare(counts: CalibrationCounts): number {
  return (counts.overconfident + counts.underconfident) / counts.answers;
}

export function rollupCalibration(
  answers: readonly CalibratedAnswer[],
): CalibrationRollup {
  const totals = emptyCounts();
  const byPage = new Map<
    string,
    { page: PageCalibration; selfSum: number; aiSum: number }
  >();
  for (const answer of answers) {
    const entry = byPage.get(answer.pageId) ?? {
      page: {
        pageId: answer.pageId,
        pageTitle: answer.pageTitle,
        notebookId: answer.notebookId,
        notebookTitle: answer.notebookTitle,
        ...emptyCounts(),
        selfAverage: 0,
        aiAverage: 0,
      },
      selfSum: 0,
      aiSum: 0,
    };
    entry.page.answers += 1;
    entry.page[answer.signal] += 1;
    entry.selfSum += answer.selfRating;
    entry.aiSum += answer.aiScore;
    byPage.set(answer.pageId, entry);
    totals.answers += 1;
    totals[answer.signal] += 1;
  }
  const pages = [...byPage.values()]
    .map(({ page, selfSum, aiSum }) => ({
      ...page,
      selfAverage: selfSum / page.answers,
      aiAverage: aiSum / page.answers,
    }))
    // Stable sort: equal shares keep the order of each page's first answer.
    .sort((a, b) => miscalibratedShare(b) - miscalibratedShare(a));
  return { pages, totals };
}
