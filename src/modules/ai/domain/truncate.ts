// Word-based token estimate for the page cap (about 0.75 words per token).
// Truncation keeps the start of the page; the UI tells the user how many
// words were used.

const WORDS_PER_TOKEN = 0.75;

export interface TruncationResult {
  text: string;
  truncated: boolean;
  wordsUsed: number;
  wordsTotal: number;
}

export function truncateToTokenCap(
  text: string,
  cap: number,
): TruncationResult {
  const matches = [...text.matchAll(/\S+/g)];
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
