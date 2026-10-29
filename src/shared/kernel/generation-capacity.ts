import { DomainError } from "./domain-error";

// How much page text an AI generation needs (Phase 8 H14, user decision
// 2026-10-29): at least MIN_GENERATION_WORDS words for any technique, and
// about WORDS_PER_ITEM words per generated item (card or question), so a
// short page is never stretched into repetitive or invented items. Words
// are counted as kernel/words.ts counts them, on the paragraphs a
// generation would actually send (the new ones after selectNewParagraphs);
// the pickers and the panel use the whole page's count as an approximation.
// Pure, no imports beyond DomainError: the client uses it too.

export const MIN_GENERATION_WORDS = 100;
export const WORDS_PER_ITEM = 15;

// Recall always asks for 10 questions (RECALL_GENERATION_COUNT).
export const RECALL_QUESTION_COUNT = 10;
// The exam counts a generation can ask for (10–30 in steps of 5).
export const EXAM_COUNT_STEPS = [10, 15, 20, 25, 30] as const;
// Flashcards send a count derived from the words, within these bounds.
export const FLASHCARD_WORD_COUNT_MIN = 3;
export const FLASHCARD_WORD_COUNT_MAX = 10;

export const PAGE_TOO_SHORT_CODE = "AI_PAGE_TOO_SHORT";

// The items `words` can carry.
export function maxItemsForWords(words: number): number {
  return Math.max(0, Math.floor(words / WORDS_PER_ITEM));
}

// The words a generation of `count` items needs.
export function requiredWordsFor(count: number): number {
  return Math.max(MIN_GENERATION_WORDS, count * WORDS_PER_ITEM);
}

export const RECALL_MIN_WORDS = requiredWordsFor(RECALL_QUESTION_COUNT);

// The exam counts `words` supports, smallest first; empty under 150 words.
export function examCountsForWords(words: number): number[] {
  if (words < MIN_GENERATION_WORDS) return [];
  const max = maxItemsForWords(words);
  return EXAM_COUNT_STEPS.filter((count) => count <= max);
}

// The cards a generation over `words` asks for: one per 15 words, between 3
// and 10 (a 100-word page yields 6).
export function flashcardCountForWords(words: number): number {
  return Math.min(
    FLASHCARD_WORD_COUNT_MAX,
    Math.max(FLASHCARD_WORD_COUNT_MIN, maxItemsForWords(words)),
  );
}

// The page (its new paragraphs) has too little text for the generation
// asked: under the minimum, or fewer words than the requested items need.
// Checked before the daily limiter, so it never costs a generation.
export class PageTooShortError extends DomainError {
  readonly words: number;
  readonly minWords: number;
  readonly maxItems: number;

  constructor(input: { words: number; minWords: number }) {
    super(
      PAGE_TOO_SHORT_CODE,
      `The page has ${input.words} words to generate from; ${input.minWords} are needed`,
    );
    this.words = input.words;
    this.minWords = input.minWords;
    this.maxItems = maxItemsForWords(input.words);
  }
}

// The details a Server Action returns with AI_PAGE_TOO_SHORT.
export interface PageTooShortDetails {
  words: number;
  minWords: number;
  maxItems: number;
}

export function pageTooShortDetails(
  error: PageTooShortError,
): PageTooShortDetails {
  return {
    words: error.words,
    minWords: error.minWords,
    maxItems: error.maxItems,
  };
}
