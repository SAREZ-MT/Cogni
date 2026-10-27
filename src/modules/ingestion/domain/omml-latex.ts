// document-import T6: makes the LaTeX officeparser derives from OMML
// equations safe to store as `inlineMath`/`blockMath`.
//
// officeparser 8.2 (utils/mathUtils.js) writes an argument without braces
// when it is a single letter or digit, also right after a command:
// `\frac` + `a` + `b` becomes `\fracab`, `\sqrt` + `y` becomes `\sqrty`.
// That is not LaTeX (`\fracab` is an unknown command). The repair is
// deterministic because officeparser escapes every character of document
// text (`\` → `\textbackslash{}`, `_` → `\_`, …): every `\name` in its
// output is one of its own commands (KNOWN_COMMANDS), so a name that is
// not a known command must be a known command followed by its lost
// one-character arguments. Anything still outside that vocabulary after
// the repair, or with unbalanced braces, is rejected (`importableLatex`
// returns null) and the mapper keeps the equation as plain text.

// Commands officeparser's OMML converter emits, with the number of
// mandatory arguments each takes. A Map, not an object literal: a lookup
// like `name in {...}` also matches names inherited from Object.prototype
// (`constructor`, `toString`, …), which would pass as known commands (T6
// review follow-up).
const COMMAND_ARITY: ReadonlyMap<string, number> = new Map(
  Object.entries({
    frac: 2,
    sqrt: 1,
    operatorname: 1,
    overline: 1,
    underline: 1,
    bar: 1,
    vec: 1,
    dot: 1,
    hat: 1,
    mathbb: 1,
    mathcal: 1,
    mathfrak: 1,
    mathtt: 1,
    mathsf: 1,
    mathrm: 1,
    mathbf: 1,
    begin: 1,
    end: 1,
    sum: 0,
    prod: 0,
    int: 0,
    iint: 0,
    iiint: 0,
    oint: 0,
    bigcup: 0,
    bigcap: 0,
    bigwedge: 0,
    bigvee: 0,
    ldots: 0,
    textbackslash: 0,
    textasciitilde: 0,
    textasciicircum: 0,
  }),
);
const KNOWN_COMMANDS = [...COMMAND_ARITY.keys()].sort(
  (a, b) => b.length - a.length,
);

const MAX_LATEX_LENGTH = 10_000;
const ALNUM = /^[0-9a-zA-Z]$/;
const LETTER = /^[a-zA-Z]$/;

// Index of the `}` closing the `{` at `open`, skipping escaped braces, or
// -1 when it is never closed.
function matchingBrace(latex: string, open: number): number {
  let depth = 0;
  for (let index = open; index < latex.length; index++) {
    const char = latex[index];
    if (char === "\\") {
      index++;
      continue;
    }
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function repairOmmlLatex(latex: string): string {
  let source = latex;
  let index = 0;
  let out = "";

  // Reads one argument at `index`: a brace group (repaired recursively) or
  // a single letter/digit (braced). Returns whether a bare character was
  // braced, so the caller can separate it from a letter that follows
  // (`^ni` → `^{n} i`).
  const takeArgument = (): boolean => {
    const char = source[index];
    if (char === "{") {
      const close = matchingBrace(source, index);
      if (close < 0) {
        out += source.slice(index);
        index = source.length;
        return false;
      }
      out += `{${repairOmmlLatex(source.slice(index + 1, close))}}`;
      index = close + 1;
      return false;
    }
    if (char !== undefined && ALNUM.test(char)) {
      out += `{${char}}`;
      index++;
      return true;
    }
    return false;
  };
  const separateFollowingLetter = (braced: boolean) => {
    const next = source[index];
    if (braced && next !== undefined && ALNUM.test(next)) out += " ";
  };

  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      let end = index + 1;
      while (end < source.length && LETTER.test(source[end])) end++;
      if (end === index + 1) {
        // An escaped character (`\_`, `\{`, `\\`) or a lone backslash.
        out += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      const letters = source.slice(index + 1, end);
      const name = COMMAND_ARITY.has(letters)
        ? letters
        : KNOWN_COMMANDS.find((command) => letters.startsWith(command));
      if (!name) {
        // Not ours: copied as is, and importableLatex rejects it.
        out += source.slice(index, end);
        index = end;
        continue;
      }
      // The letters after the command name are its lost arguments (or, for
      // an operator, the start of its operand).
      out += `\\${name}`;
      source = letters.slice(name.length) + source.slice(end);
      index = 0;
      const arity = COMMAND_ARITY.get(name) ?? 0;
      if (arity === 0) {
        if (letters.length > name.length) out += " ";
        continue;
      }
      if (name === "sqrt" && source[index] === "[") {
        const close = source.indexOf("]", index);
        if (close > index) {
          out += source.slice(index, close + 1);
          index = close + 1;
        }
      }
      let braced = false;
      for (let argument = 0; argument < arity; argument++) {
        braced = takeArgument();
      }
      separateFollowingLetter(braced);
      continue;
    }
    if (char === "^" || char === "_") {
      out += char;
      index++;
      separateFollowingLetter(takeArgument());
      continue;
    }
    if (char === "{") {
      const close = matchingBrace(source, index);
      if (close < 0) {
        out += source.slice(index);
        break;
      }
      out += `{${repairOmmlLatex(source.slice(index + 1, close))}}`;
      index = close + 1;
      continue;
    }
    out += char;
    index++;
  }
  return out;
}

function hasBalancedBraces(latex: string): boolean {
  let depth = 0;
  for (let index = 0; index < latex.length; index++) {
    const char = latex[index];
    if (char === "\\") {
      index++;
      continue;
    }
    if (char === "{") depth++;
    if (char === "}" && --depth < 0) return false;
  }
  return depth === 0;
}

function usesOnlyKnownCommands(latex: string): boolean {
  let begins = 0;
  let ends = 0;
  for (const match of latex.matchAll(/\\([a-zA-Z]+)/g)) {
    const name = match[1];
    if (!COMMAND_ARITY.has(name)) return false;
    if (name === "begin") begins++;
    if (name === "end") ends++;
  }
  return begins === ends;
}

// The repaired LaTeX when it is safe to store as a math node, else null
// (the caller falls back to the equation's text).
export function importableLatex(latex: string): string | null {
  const repaired = repairOmmlLatex(latex).trim();
  if (repaired.length === 0 || repaired.length > MAX_LATEX_LENGTH) return null;
  if (!hasBalancedBraces(repaired)) return null;
  if (!usesOnlyKnownCommands(repaired)) return null;
  return repaired;
}
