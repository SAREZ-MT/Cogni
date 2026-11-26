// Deterministic check of a model evaluation against the question's rubric
// (security-hardening S2). The student's answer is untrusted text inside the
// evaluation prompt, so the model's output is not taken at face value:
// concepts outside the rubric are dropped, and a score that contradicts the
// model's own concept lists is lowered. The check never raises a score.

export interface ModelEvaluation {
  readonly score: number;
  readonly presentConcepts: readonly string[];
  readonly missingConcepts: readonly string[];
  readonly misconceptions: readonly string[];
  readonly justification: string;
}

export interface CheckedEvaluation {
  score: number;
  presentConcepts: string[];
  missingConcepts: string[];
  misconceptions: string[];
  justification: string;
  // The model's own score, kept only when the check lowered it.
  modelScore?: number;
}

// Highest score of an answer that covers no key concept, and of one that
// misses at least one: the two ends of the rubric scale the prompt states
// (5 = every key concept, 0-1 = almost nothing). The middle of the scale is
// the model's judgement and stays untouched.
export const MAX_SCORE_NO_CONCEPT = 1;
export const MAX_SCORE_MISSING_CONCEPT = 4;

// Two wordings name the same concept when they differ only in case,
// accents, spacing or surrounding punctuation ("Glucolisis." = "glucólisis"):
// models often copy a concept with such small changes.
function normalized(concept: string): string {
  return concept
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "");
}

export function checkEvaluation(
  evaluation: ModelEvaluation,
  keyConcepts: readonly string[],
): CheckedEvaluation {
  const present = new Set(evaluation.presentConcepts.map(normalized));
  const missing = new Set(evaluation.missingConcepts.map(normalized));

  // In the rubric's order and wording; a concept in both lists is present.
  const presentConcepts = keyConcepts.filter((c) => present.has(normalized(c)));
  const missingConcepts = keyConcepts.filter(
    (c) => !present.has(normalized(c)) && missing.has(normalized(c)),
  );

  const checked: CheckedEvaluation = {
    score: evaluation.score,
    presentConcepts,
    missingConcepts,
    misconceptions: [...evaluation.misconceptions],
    justification: evaluation.justification,
  };

  // The lists only bound the score when the model placed every key concept
  // in one of them, as the prompt asks. Lists that do not follow the rubric
  // (paraphrased or partial) cannot contradict the score, so a correct
  // answer is never marked down because of them.
  const accounted =
    presentConcepts.length + missingConcepts.length === keyConcepts.length;
  if (!accounted || keyConcepts.length === 0) return checked;

  const cap =
    presentConcepts.length === 0
      ? MAX_SCORE_NO_CONCEPT
      : missingConcepts.length > 0
        ? MAX_SCORE_MISSING_CONCEPT
        : evaluation.score;
  if (evaluation.score > cap) {
    checked.score = cap;
    checked.modelScore = evaluation.score;
  }
  return checked;
}
