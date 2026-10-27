// document-import T9b/T7: a linear scanner over the element tags of an
// OOXML part, shared by the DOCX hidden-text filter (ooxml-hidden-text.ts)
// and the PPTX slide readers (pptx-xml.ts). Quoted attribute values may
// contain `>`; comments, CDATA, declarations and processing instructions
// are skipped. No DOM is built: callers track the element stack they need
// and cut ranges out of the original string, so everything else stays
// byte for byte.

export type Tag = {
  kind: "open" | "close" | "empty";
  name: string;
  attrs: string;
  start: number;
  end: number;
};

// Every element tag in order; comments, CDATA, declarations and
// processing instructions are skipped. Stops at an unterminated tag.
export function* tags(xml: string): Generator<Tag> {
  let index = 0;
  const length = xml.length;
  while (index < length) {
    const open = xml.indexOf("<", index);
    if (open === -1) return;
    const next = xml[open + 1];
    if (next === "!" || next === "?") {
      const terminator = xml.startsWith("<!--", open)
        ? "-->"
        : xml.startsWith("<![CDATA[", open)
          ? "]]>"
          : next === "?"
            ? "?>"
            : ">";
      const close = xml.indexOf(terminator, open + 2);
      if (close === -1) return;
      index = close + terminator.length;
      continue;
    }
    let cursor = open + 1;
    let quote = "";
    while (cursor < length) {
      const char = xml[cursor];
      if (quote) {
        if (char === quote) quote = "";
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        break;
      }
      cursor++;
    }
    if (cursor >= length) return;
    const closing = next === "/";
    const body = xml.slice(closing ? open + 2 : open + 1, cursor);
    const selfClosing = !closing && body.endsWith("/");
    const inner = selfClosing ? body.slice(0, -1) : body;
    const nameEnd = inner.search(/[\s/]|$/);
    yield {
      kind: closing ? "close" : selfClosing ? "empty" : "open",
      name: inner.slice(0, nameEnd),
      attrs: inner.slice(nameEnd),
      start: open,
      end: cursor + 1,
    };
    index = cursor + 1;
  }
}

// The value of an attribute by local name, whatever its prefix.
export function attribute(attrs: string, local: string): string | null {
  const match = new RegExp(
    `(?:^|\\s)(?:[\\w.-]+:)?${local}\\s*=\\s*(["'])(.*?)\\1`,
  ).exec(attrs);
  return match ? match[2] : null;
}

// The value of an attribute by its exact qualified name (`r:id`, `Id`).
export function qualifiedAttribute(attrs: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(["'])(.*?)\\1`).exec(
    attrs,
  );
  return match ? decodeXmlEntities(match[2]) : null;
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

// XML 1.0's `Char`: a reference to anything else (NUL, other C0
// controls, surrogates, U+FFFE/U+FFFF, past U+10FFFF) is not well-formed.
function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

// The five predefined entities and numeric character references, in one
// pass (`&amp;lt;` becomes `&lt;`). Anything else is kept as written.
export function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code =
        ref[1] === "x" || ref[1] === "X"
          ? Number.parseInt(ref.slice(2), 16)
          : Number.parseInt(ref.slice(1), 10);
      return isXmlChar(code) ? String.fromCodePoint(code) : whole;
    }
    return Object.hasOwn(ENTITIES, ref) ? ENTITIES[ref] : whole;
  });
}
