// What a "word" is wherever page text is measured: a run of non-whitespace
// characters. ai's truncateToTokenCap and the paragraph word counts of
// incremental generation (page-paragraphs.ts) share it, so the paragraphs
// a truncation sent can be told from its word count. Pure, no imports.
export const WORD_PATTERN = /\S+/g;

export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}
