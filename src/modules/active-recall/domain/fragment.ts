import type { RecallQuestion } from "./recall-question";

// The page context sent with an evaluation is the page fragment most similar
// to the question, trimmed to the token cap (§8.5: simple lexical search in
// v1, no embeddings). The token estimate is the same word-based one as
// ai/domain/truncate.ts (about 0.75 words per token); it is repeated here
// because the domain may import only shared/kernel.
const WORDS_PER_TOKEN = 0.75;

// Words too common to tell two passages apart, already normalized (lower
// case, no accents). Words shorter than three letters are dropped anyway.
const STOP_WORDS = new Set(
  [
    // Spanish
    "que los las del una uno unos unas con por para como mas pero sus son",
    "ser esta este esto estos estas ese esa eso esos esas entre sobre sin",
    "hay fue han cual cuales cuando donde porque tambien muy les nos ella",
    "ellos todo todos cada segun desde hasta durante otro otra otros otras",
    // English
    "the and for with that this are was from its not what which how why",
    "into than then they",
  ]
    .join(" ")
    .split(" "),
);

// Lower case, accents and punctuation removed, short and stop words dropped.
export function normalizeTerms(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

type FragmentQuestion = Pick<RecallQuestion, "prompt"> & {
  rubric: Pick<RecallQuestion["rubric"], "keyConcepts">;
};

interface Unit {
  // Word index range [start, end).
  readonly start: number;
  readonly end: number;
  readonly score: number;
}

// Returns the whole text when it fits the cap. Otherwise splits it into
// sentences (a sentence ends at . ! ? … or a line break; one longer than
// the cap is cut into cap-sized word chunks), scores each by how many of
// its words are terms of the prompt or the rubric's key concepts, and
// returns the contiguous run of sentences that fits the cap with the
// highest score, the earliest on a tie. With no match at all it keeps the
// start of the page, like the generation truncation.
export function selectRelevantFragment(
  plainText: string,
  question: FragmentQuestion,
  tokenCap: number,
): string {
  const words = [...plainText.matchAll(/\S+/g)];
  if (words.length === 0) return "";
  const maxWords = Math.max(0, Math.floor(tokenCap * WORDS_PER_TOKEN));
  if (words.length <= maxWords) return plainText;
  if (maxWords === 0) return "";

  const query = new Set(
    normalizeTerms([question.prompt, ...question.rubric.keyConcepts].join(" ")),
  );
  const units = splitUnits(plainText, words, maxWords, query);
  const best = bestWindow(units, maxWords);
  if (best.score === 0) return slice(plainText, words, 0, maxWords);
  return slice(
    plainText,
    words,
    units[best.from].start,
    units[best.to - 1].end,
  );
}

function splitUnits(
  text: string,
  words: RegExpExecArray[],
  maxWords: number,
  query: ReadonlySet<string>,
): Unit[] {
  const units: Unit[] = [];
  let start = 0;
  let score = 0;
  for (let i = 0; i < words.length; i += 1) {
    score += normalizeTerms(words[i][0]).filter((t) => query.has(t)).length;
    const next = words[i + 1];
    const gap = next ? text.slice(endOf(words[i]), next.index) : "";
    const endsSentence =
      /[.!?…]["'»)\]]*$/u.test(words[i][0]) || gap.includes("\n");
    if (!next || endsSentence || i + 1 - start === maxWords) {
      units.push({ start, end: i + 1, score });
      start = i + 1;
      score = 0;
    }
  }
  return units;
}

// Two pointers over the units: for each start, the longest run that fits.
function bestWindow(units: readonly Unit[], maxWords: number) {
  let best = { from: 0, to: 1, score: 0 };
  let to = 0;
  let words = 0;
  let score = 0;
  for (let from = 0; from < units.length; from += 1) {
    while (
      to < units.length &&
      words + (units[to].end - units[to].start) <= maxWords
    ) {
      words += units[to].end - units[to].start;
      score += units[to].score;
      to += 1;
    }
    if (score > best.score) best = { from, to, score };
    words -= units[from].end - units[from].start;
    score -= units[from].score;
  }
  return best;
}

function slice(
  text: string,
  words: RegExpExecArray[],
  start: number,
  end: number,
): string {
  return text.slice(words[start].index, endOf(words[end - 1]));
}

function endOf(word: RegExpExecArray): number {
  return word.index + word[0].length;
}
