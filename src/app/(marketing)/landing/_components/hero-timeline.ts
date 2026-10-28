// Scroll timeline of the hero scene. Every value is a pure function of the
// pinned track's scroll progress (0 at the top of the track, 1 when the pin
// releases), so scrolling back up plays the scene in reverse.

export const HERO_SENTENCE =
  "Cogni es tu plataforma de estudio, donde aprender y recordar por fin van de la mano.";

// Three balanced lines on wide screens; on phones they flow as one paragraph.
export const HERO_LINES: readonly (readonly string[])[] = [
  ["Cogni", "es", "tu", "plataforma", "de", "estudio,"],
  ["donde", "aprender", "y", "recordar"],
  ["por", "fin", "van", "de", "la", "mano."],
];

export const HERO_WORDS: readonly string[] = HERO_LINES.flat();

// Phases, as fractions of the track.
const SETTLE_END = 0.1;
const WORDS_START = 0.12;
const WORDS_END = 0.8;
// Each word sharpens over this share of the track; neighbours overlap, so
// the reveal reads as a soft wave rather than a ticker.
const WORD_WINDOW = 0.1;
const OUTRO_START = 0.83;
const OUTRO_END = 0.93;
const NETWORK_END = 0.88;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function span(progress: number, start: number, end: number) {
  return clamp01((progress - start) / (end - start));
}

/** 0 → 1 as the headline settles from its first-view size. */
export function settleProgress(progress: number) {
  return span(progress, 0, SETTLE_END);
}

/** 0 (blurred, dim) → 1 (sharp, white) for the word at `index`. */
export function wordProgress(progress: number, index: number) {
  const stride =
    (WORDS_END - WORDS_START - WORD_WINDOW) / (HERO_WORDS.length - 1);
  const start = WORDS_START + index * stride;
  return span(progress, start, start + WORD_WINDOW);
}

/** Words that read as revealed (past the midpoint of their sharpen). */
export function revealedWordCount(progress: number) {
  return HERO_WORDS.filter((_, i) => wordProgress(progress, i) >= 0.5).length;
}

/** 0 → 1 for the subtitle and the actions, after the last word. */
export function outroProgress(progress: number) {
  return span(progress, OUTRO_START, OUTRO_END);
}

/** 0 → 1 growth of the background network; full when the sentence is. */
export function networkGrowth(progress: number) {
  return span(progress, 0, NETWORK_END);
}
