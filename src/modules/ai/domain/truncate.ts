// Word-based token estimate for the page cap (about 0.75 words per token).
// Truncation keeps the start of the page; the UI tells the user how many
// words were used.

import { WORD_PATTERN } from "@/shared/kernel/words";

const WORDS_PER_TOKEN = 0.75;

export interface TruncationResult {
  text: string;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
}

// The same estimate as a single number: ceil(words / 0.75).
export function estimateTokens(text: string): number {
  const words = text.match(WORD_PATTERN)?.length ?? 0;
  return Math.ceil(words / WORDS_PER_TOKEN);
}

// The largest evaluate_recall_answer prompt (system + prompt, estimated)
// a batched evaluation aims for: under Groq's 7K prompt ceiling with room
// for the evaluations it writes back inside the 8K TPM window.
export const EVALUATION_PROMPT_TOKEN_BUDGET = 6500;

export function truncateToTokenCap(
  text: string,
  cap: number,
): TruncationResult {
  const matches = [...text.matchAll(WORD_PATTERN)];
  const wordsTotal = matches.length;
  if (wordsTotal === 0) {
    return { text: "", truncated: false, wordsUsed: 0, wordsTotal: 0 };
  }

  // ceil(words / 0.75) <= cap  <=>  words <= floor(cap * 0.75)
  const maxWords = Math.max(0, Math.floor(cap * WORDS_PER_TOKEN));
  if (wordsTotal <= maxWords) {
    return { text, truncated: false, wordsUsed: wordsTotal, wordsTotal };
  }
  if (maxWords === 0) {
    return { text: "", truncated: true, wordsUsed: 0, wordsTotal };
  }

  const last = matches[maxWords - 1];
  const end = (last.index ?? 0) + last[0].length;
  return {
    text: text.slice(0, end),
    truncated: true,
    wordsUsed: maxWords,
    wordsTotal,
  };
}
