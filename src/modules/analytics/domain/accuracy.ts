// "Tasa de acierto" per technique (§3.6, decision 2026-10-12) over the
// dashboard range.

export interface AccuracyTally {
  correct: number;
  total: number;
}

// A flashcard review counts as a hit from "Bien" (quality 3) up, i.e. not
// "Otra vez"; the same threshold §7.3 uses for a hit in page mastery.
export const FLASHCARD_HIT_QUALITY = 3;

// A recall answer counts as correct when the rubric evaluation scored it
// 3 or more out of 5.
export const RECALL_CORRECT_AI_SCORE = 3;

// The share of correct outcomes, null when there is nothing to rate.
export function accuracyRate(tally: AccuracyTally): number | null {
  return tally.total === 0 ? null : tally.correct / tally.total;
}

function tally<T>(
  outcomes: readonly T[],
  isCorrect: (outcome: T) => boolean,
): AccuracyTally {
  return {
    correct: outcomes.filter(isCorrect).length,
    total: outcomes.length,
  };
}

export function flashcardAccuracy(
  reviews: readonly { quality: number }[],
): AccuracyTally {
  return tally(reviews, (review) => review.quality >= FLASHCARD_HIT_QUALITY);
}

export function examAccuracy(
  answers: readonly { isCorrect: boolean }[],
): AccuracyTally {
  return tally(answers, (answer) => answer.isCorrect);
}

export function recallAccuracy(
  answers: readonly { aiScore: number }[],
): AccuracyTally {
  return tally(answers, (answer) => answer.aiScore >= RECALL_CORRECT_AI_SCORE);
}
