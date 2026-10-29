import { createHash } from "node:crypto";
import { countWords } from "./words";

// Incremental generation (Phase 6 T5c, user decision 2026-10-06): a page's
// plain text is split into paragraphs and each technique remembers the
// fingerprints of the paragraphs it already sent to the AI, so "Generar"
// only sends new or edited ones. Shared by flashcards, exams and active
// recall; pure apart from hashing (node:crypto, server runtime only).

export interface PageParagraph {
  // The paragraph as written (trimmed), the text sent to the model.
  readonly text: string;
  // sha256 hex of normalizeParagraph(text).
  readonly fingerprint: string;
  // Words as kernel/words.ts counts them (the same count as ai's
  // truncateToTokenCap).
  readonly words: number;
}

// Case, inner whitespace, surrounding whitespace and the Unicode form of
// accents (composed "é" or "e" + combining accent, NFC) never make a
// paragraph new: "  La  Célula " and "la célula" are the same paragraph.
export function normalizeParagraph(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function fingerprintParagraph(text: string): string {
  return createHash("sha256")
    .update(normalizeParagraph(text), "utf8")
    .digest("hex");
}

// Every non-blank line is a paragraph (notebooks' extractPlainText writes
// one block per line); blank lines only separate them. Page order is kept.
export function splitParagraphs(plainText: string): PageParagraph[] {
  return plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text) => ({
      text,
      fingerprint: fingerprintParagraph(text),
      words: countWords(text),
    }));
}

// The page's paragraphs whose fingerprint is not in `known`, in page order.
// A paragraph repeated on the page is kept once (its first occurrence): it
// is one fingerprint. Nothing known (a first generation, or a page
// generated before fingerprints existed) keeps every paragraph.
export function selectNewParagraphs(
  plainText: string,
  known: Iterable<string>,
): PageParagraph[] {
  const seen = new Set(known);
  const fresh: PageParagraph[] = [];
  for (const paragraph of splitParagraphs(plainText)) {
    if (seen.has(paragraph.fingerprint)) continue;
    seen.add(paragraph.fingerprint);
    fresh.push(paragraph);
  }
  return fresh;
}

// The text sent to the model: the paragraphs one per line, in order.
export function joinParagraphs(paragraphs: readonly PageParagraph[]): string {
  return paragraphs.map((p) => p.text).join("\n");
}

// The paragraphs of joinParagraphs(paragraphs) a word truncation counts as
// used: `wordsUsed` is truncateToTokenCap's count. Every paragraph it kept
// whole is used; a paragraph cut in the middle (and every one after it)
// stays new for the next generation — unless it is the FIRST one, i.e. a
// single paragraph longer than the whole cap: its start was sent, so it is
// used as is (its tail is never sent). Otherwise every "Generar" would send
// the same cut start again and spend a generation without progress.
export function paragraphsWithinWords(
  paragraphs: readonly PageParagraph[],
  wordsUsed: number,
): PageParagraph[] {
  const kept: PageParagraph[] = [];
  let words = 0;
  for (const paragraph of paragraphs) {
    words += paragraph.words;
    if (words > wordsUsed) break;
    kept.push(paragraph);
  }
  if (kept.length === 0 && wordsUsed > 0 && paragraphs.length > 0) {
    return [paragraphs[0]];
  }
  return kept;
}

// The sent paragraphs a generation counts as used once `accepted` of the
// `requested` items came back (Phase 8 H14): all of them when every item
// came back; otherwise the share of the sent words the accepted items
// cover, from the start (paragraphsWithinWords, so the first one counts as
// soon as any item came back). The rest stays new for the next "Generar",
// instead of being marked used by a generation that returned few items.
export function consumedParagraphs(
  sent: readonly PageParagraph[],
  accepted: number,
  requested: number,
): PageParagraph[] {
  if (accepted <= 0) return [];
  if (requested <= 0 || accepted >= requested) return [...sent];
  const words = sent.reduce((sum, p) => sum + p.words, 0);
  return paragraphsWithinWords(
    sent,
    Math.round((words * accepted) / requested),
  );
}
