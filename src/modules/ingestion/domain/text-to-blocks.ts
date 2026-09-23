// design.md, "Decision: Algoritmo textToBlocks, reglas de la spec
// pdf-import" — a pure, deterministic conversion from extracted PDF page
// text to TipTap-compatible blocks. Each page is converted separately and
// the resulting blocks are concatenated in page order: no block ever spans
// two pages (R9's last sentence), so per-page processing needs no special
// "page boundary" case beyond "start a fresh state per page".
import {
  type ImportedBlock,
  type ImportedDoc,
  importedBulletList,
  importedHeading,
  importedOrderedList,
  importedParagraph,
} from "./imported-doc";

export interface TextToBlocksResult {
  doc: ImportedDoc;
  totalPages: number;
  pagesWithText: number;
  pagesWithoutText: number; // pagesWithText + pagesWithoutText === totalPages
}

// R2: a line of only digits is page numbering — discarded entirely; it
// counts neither as blank nor as a text line, and has no effect on
// R4's neighbor search (which already ignores blank lines).
const PAGE_NUMBER_LINE = /^\d+$/;

// R3: "- ", "• " or "* " followed by non-blank content.
const BULLET_MARKER = /^[-•*] (\S.*)$/;
// R4 rule 1: "N) ..." is always an ordered item, regardless of neighbors.
const ORDERED_PAREN_MARKER = /^(\d+)\) (\S.*)$/;
// R4 rule 2: "N. ..." is an ordered item only when a neighbor agrees.
const ORDERED_DOT_MARKER = /^(\d+)\. (\S.*)$/;

// R5(a): "N." / "N.N" / "N.N.N"... prefix followed by a space and
// non-blank content. A single-level prefix ("N") requires the trailing
// dot, or a bare integer at the start of a sentence ("3 manzanas rojas",
// "2020 fue un año difícil") would be misread as a heading (T3 follow-up:
// R3-bare-number-heading). A multi-level prefix ("N.N", "N.N.N", ...)
// already can't be confused with a bare number, so its trailing dot stays
// optional, matching the multi-level examples in the E1-E20 table (e.g.
// "1.1 SECCIÓN DOS").
const NUMERIC_HEADING_PREFIX_SINGLE_LEVEL = /^(\d+)\.\s(\S.*)$/;
const NUMERIC_HEADING_PREFIX_MULTI_LEVEL = /^(\d+(?:\.\d+)+)\.?\s(\S.*)$/;
// R5(b): a valid uppercase Roman numeral (1-3999) followed by ". ".
const ROMAN_HEADING_PREFIX =
  /^(M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3}))\. (\S.*)$/;
// R5: a heading never ends in one of these.
const FORBIDDEN_TRAILING = /[.,;:!?]$/;

// R1: control characters (Unicode category Cc: C0 + DEL + C1) other than
// \n and \t, plus the soft hyphen U+00AD — an invisible formatting
// character — are removed. \t survives this step because the next step
// collapses it into a space like any other whitespace run.
function stripControlsAndSoftHyphen(text: string): string {
  return text.replace(/[\p{Cc}­]/gu, (char) =>
    char === "\n" || char === "\t" ? char : "",
  );
}

// R1: normalize newlines, strip control characters, fold NBSP and the
// other Unicode space separators (category Zs) to a plain space, then
// collapse each line's space/tab runs to one space and trim it.
function normalizePageText(raw: string): string {
  const unifiedNewlines = raw.replace(/\r\n|\r/g, "\n");
  const withoutControls = stripControlsAndSoftHyphen(unifiedNewlines);
  const withPlainSpaces = withoutControls.replace(/\p{Zs}/gu, " ");
  return withPlainSpaces
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
}

function isAllUppercase(line: string): boolean {
  return /\p{L}/u.test(line) && !/\p{Ll}/u.test(line);
}

// R5/R6: null when `line` is not a heading; otherwise its level (1-3).
function headingLevel(line: string): number | null {
  if (line.length > 80) return null;
  if (!/\p{L}/u.test(line)) return null;
  if (FORBIDDEN_TRAILING.test(line)) return null;

  // R6: "si hay prefijo y además mayúsculas, decide el prefijo" — the
  // numeric/Roman prefix checks run before the all-uppercase fallback.
  const numericMultiLevel = NUMERIC_HEADING_PREFIX_MULTI_LEVEL.exec(line);
  if (numericMultiLevel) {
    const segments = numericMultiLevel[1].split(".").length;
    return Math.min(segments, 3);
  }
  const numericSingleLevel = NUMERIC_HEADING_PREFIX_SINGLE_LEVEL.exec(line);
  if (numericSingleLevel) return 1;
  const roman = ROMAN_HEADING_PREFIX.exec(line);
  if (roman && roman[1].length > 0) return 1;
  if (isAllUppercase(line)) return 1;
  return null;
}

// R7's join rule (also used by R8 for item continuations): a hyphenated
// line break joins without the hyphen when it falls mid-word (previous
// line ends in a letter + "-", next line starts with a lowercase letter).
function joinLines(previous: string, next: string): string {
  if (/\p{L}-$/u.test(previous) && /^\p{Ll}/u.test(next)) {
    return previous.slice(0, -1) + next;
  }
  return `${previous} ${next}`;
}

type LineToken =
  | { kind: "bullet"; text: string }
  | { kind: "ordered"; number: number; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "text"; text: string };

// Classifies one content line (blank and page-numbering lines never reach
// here). `previousToken` is the token of the immediately preceding
// content line (blanks skipped, per R4), and `nextContentLine` is the raw
// text of the immediately following content line (also blanks skipped),
// or null at the page's edges.
function classifyLine(
  line: string,
  previousToken: LineToken | null,
  nextContentLine: string | null,
): LineToken {
  const bullet = BULLET_MARKER.exec(line);
  if (bullet) return { kind: "bullet", text: bullet[1] };

  const paren = ORDERED_PAREN_MARKER.exec(line);
  if (paren) {
    return { kind: "ordered", number: Number(paren[1]), text: paren[2] };
  }

  const dot = ORDERED_DOT_MARKER.exec(line);
  if (dot) {
    const number = Number(dot[1]);
    const previousIsPredecessor =
      previousToken?.kind === "ordered" && previousToken.number === number - 1;
    const nextIsSuccessor =
      nextContentLine != null &&
      new RegExp(`^${number + 1}[.)] `).test(nextContentLine);
    if (previousIsPredecessor || nextIsSuccessor) {
      return { kind: "ordered", number, text: dot[2] };
    }
    // Neighbors disagree: fall through and test the full line (prefix
    // kept, per R5's "el texto conserva el prefijo tal como aparece") as
    // a heading or a plain paragraph line.
  }

  const level = headingLevel(line);
  if (level != null) return { kind: "heading", level, text: line };

  return { kind: "text", text: line };
}

type OpenBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bulletList"; items: string[] }
  | { kind: "orderedList"; start: number; items: string[] };

function closeOpenBlock(open: OpenBlock | null): ImportedBlock | null {
  if (open == null) return null;
  if (open.kind === "paragraph") return importedParagraph(open.text);
  if (open.kind === "bulletList") return importedBulletList(open.items);
  return importedOrderedList(open.items, open.start);
}

function pageToBlocks(normalizedPage: string): ImportedBlock[] {
  if (normalizedPage.trim().length === 0) return [];

  const rawLines = normalizedPage.split("\n");
  // R4 needs "the next non-blank content line" as lookahead; numbering
  // lines are dropped from this list too, since R2 says they count as
  // neither a blank line nor a text line.
  const contentLines = rawLines.filter(
    (line) => line.length > 0 && !PAGE_NUMBER_LINE.test(line),
  );

  const blocks: ImportedBlock[] = [];
  let open: OpenBlock | null = null;
  let previousToken: LineToken | null = null;
  let contentIndex = 0;

  for (const line of rawLines) {
    // R9: one or more blank lines close the open paragraph/list.
    if (line.length === 0) {
      const closed = closeOpenBlock(open);
      if (closed) blocks.push(closed);
      open = null;
      continue;
    }
    // R2: page-numbering line, dropped without any effect.
    if (PAGE_NUMBER_LINE.test(line)) continue;

    const nextContentLine = contentLines[contentIndex + 1] ?? null;
    const token = classifyLine(line, previousToken, nextContentLine);
    contentIndex += 1;
    previousToken = token;

    if (token.kind === "heading") {
      // R9: a heading closes whatever was open and never merges itself.
      const closed = closeOpenBlock(open);
      if (closed) blocks.push(closed);
      open = null;
      blocks.push(importedHeading(token.level as 1 | 2 | 3, token.text));
      continue;
    }

    if (token.kind === "bullet") {
      if (open?.kind === "bulletList") {
        open.items.push(token.text);
      } else {
        // R9: a list item also closes an open paragraph, and a type
        // change (ordered -> bullet) closes the previous list.
        const closed = closeOpenBlock(open);
        if (closed) blocks.push(closed);
        open = { kind: "bulletList", items: [token.text] };
      }
      continue;
    }

    if (token.kind === "ordered") {
      if (open?.kind === "orderedList") {
        open.items.push(token.text);
      } else {
        const closed = closeOpenBlock(open);
        if (closed) blocks.push(closed);
        open = {
          kind: "orderedList",
          start: token.number,
          items: [token.text],
        };
      }
      continue;
    }

    // token.kind === "text": R7 paragraph join, or R8 item continuation.
    if (open == null) {
      open = { kind: "paragraph", text: token.text };
    } else if (open.kind === "paragraph") {
      open.text = joinLines(open.text, token.text);
    } else {
      const lastIndex = open.items.length - 1;
      open.items[lastIndex] = joinLines(open.items[lastIndex], token.text);
    }
  }

  const closed = closeOpenBlock(open);
  if (closed) blocks.push(closed);
  return blocks;
}

export function textToBlocks(pages: string[]): TextToBlocksResult {
  let pagesWithText = 0;
  const content: ImportedBlock[] = [];

  for (const page of pages) {
    const normalized = normalizePageText(page);
    // P0: a page whose normalized text is empty or only whitespace has no
    // text at all, and produces no blocks. A page with only page-number
    // lines (e.g. "12") still counts as "with text" here (its raw content
    // is non-blank) even though R2 later discards every one of its lines,
    // leaving it with zero blocks — the spec gap resolved in design.md.
    if (normalized.trim().length > 0) pagesWithText += 1;
    content.push(...pageToBlocks(normalized));
  }

  return {
    doc: { type: "doc", content },
    totalPages: pages.length,
    pagesWithText,
    pagesWithoutText: pages.length - pagesWithText,
  };
}
