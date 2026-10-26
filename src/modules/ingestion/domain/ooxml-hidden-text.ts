// document-import T9b (security audit 2026-10-26, AI-bound invisible text):
// text Word hides (`w:vanish`, `w:specVanish`) is never shown to the user,
// but mammoth 1.13 ignores both properties and would import it — and
// imported text feeds the AI. Hidden runs are removed from
// `word/document.xml` before mammoth or officeparser parse it.
//
// A run is hidden when its own properties say so; otherwise when its
// character style (rStyle) does; otherwise when its paragraph's style
// (pStyle) does — Word's precedence, `basedOn` chains followed.
// `w:val="0" | "false" | "off"` turns the property off at that level.
// Not resolved (residual): document defaults (docDefaults), table and
// numbering styles, and tracked formatting changes (`w:rPrChange`, which
// records the *previous* formatting and is ignored on purpose).
//
// One linear pass over the tags (quoted attribute values may contain
// `>`), tracking the element stack so a run nested in a text box inside
// another run is judged on its own; the removed ranges are cut from the
// original string, so everything else stays byte for byte.
const WORD_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  "http://purl.oclc.org/ooxml/wordprocessingml/main",
]);
const OFF_VALUES = new Set(["0", "false", "off"]);

type Tag = {
  kind: "open" | "close" | "empty";
  name: string;
  attrs: string;
  start: number;
  end: number;
};

// Every element tag in order; comments, CDATA, declarations and
// processing instructions are skipped. Stops at an unterminated tag.
function* tags(xml: string): Generator<Tag> {
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

function wordPrefixes(xml: string): Set<string> {
  const prefixes = new Set<string>();
  for (const match of xml.matchAll(
    /xmlns(?::([\w.-]+))?\s*=\s*(["'])(.*?)\2/g,
  )) {
    if (WORD_NAMESPACES.has(match[3])) prefixes.add(match[1] ?? "");
  }
  if (prefixes.size === 0) prefixes.add("w");
  return prefixes;
}

// The WordprocessingML local name of a qualified name, or null for an
// element of another namespace.
function localName(name: string, prefixes: Set<string>): string | null {
  const colon = name.indexOf(":");
  const prefix = colon === -1 ? "" : name.slice(0, colon);
  return prefixes.has(prefix) ? name.slice(colon + 1) : null;
}

function attribute(attrs: string, local: string): string | null {
  const match = new RegExp(
    `(?:^|\\s)(?:[\\w.-]+:)?${local}\\s*=\\s*(["'])(.*?)\\1`,
  ).exec(attrs);
  return match ? match[2] : null;
}

function isOn(attrs: string): boolean {
  const value = attribute(attrs, "val");
  return value === null || !OFF_VALUES.has(value.trim().toLowerCase());
}

type Frame = {
  name: string;
  local: string | null;
  start: number;
  // w:r: hidden by its own properties (true/false), or undefined.
  hidden?: boolean;
  style?: string | null;
};

function hiddenProperty(tag: Tag, local: string | null): boolean | undefined {
  if (local !== "vanish" && local !== "specVanish") return undefined;
  return isOn(tag.attrs);
}

// styleId → its own vanish setting and the style it is based on.
type StyleTable = Map<string, { hidden?: boolean; basedOn: string | null }>;

function readStyles(stylesXml: string): StyleTable {
  const prefixes = wordPrefixes(stylesXml);
  const styles: StyleTable = new Map();
  const stack: Frame[] = [];
  let current: { hidden?: boolean; basedOn: string | null } | null = null;
  for (const tag of tags(stylesXml)) {
    const local = localName(tag.name, prefixes);
    if (tag.kind === "close") {
      const frame = stack.pop();
      if (frame?.local === "style") current = null;
      continue;
    }
    const parent = stack.at(-1);
    if (local === "style" && tag.kind === "open") {
      current = { basedOn: null };
      const id = attribute(tag.attrs, "styleId");
      if (id) styles.set(id, current);
    } else if (current && parent?.local === "style" && local === "basedOn") {
      current.basedOn = attribute(tag.attrs, "val");
    } else if (
      current &&
      parent?.local === "rPr" &&
      stack.at(-2)?.local === "style"
    ) {
      const hidden = hiddenProperty(tag, local);
      if (hidden !== undefined) current.hidden = current.hidden || hidden;
    }
    if (tag.kind === "open") {
      stack.push({ name: tag.name, local, start: tag.start });
    }
  }
  return styles;
}

function styleHidden(
  styles: StyleTable,
  id: string | null | undefined,
): boolean | undefined {
  const seen = new Set<string>();
  let current = id ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    const style = styles.get(current);
    if (!style) return undefined;
    if (style.hidden !== undefined) return style.hidden;
    current = style.basedOn;
  }
  return undefined;
}

export function stripHiddenRuns(documentXml: string, stylesXml = ""): string {
  if (!/vanish/i.test(documentXml) && !/vanish/i.test(stylesXml)) {
    return documentXml;
  }
  const prefixes = wordPrefixes(documentXml);
  const styles = stylesXml ? readStyles(stylesXml) : new Map();
  const stack: Frame[] = [];
  const removed: Array<[number, number]> = [];

  for (const tag of tags(documentXml)) {
    const local = localName(tag.name, prefixes);
    if (tag.kind === "close") {
      // Pop to the matching element (tolerates unbalanced input).
      let frame = stack.pop();
      while (frame && frame.name !== tag.name) frame = stack.pop();
      if (frame?.local !== "r") continue;
      const paragraph = [...stack].reverse().find((f) => f.local === "p");
      const hidden =
        frame.hidden ??
        styleHidden(styles, frame.style) ??
        styleHidden(styles, paragraph?.style) ??
        false;
      if (hidden) removed.push([frame.start, tag.end]);
      continue;
    }
    const parent = stack.at(-1);
    const grandparent = stack.at(-2);
    if (parent?.local === "rPr" && grandparent?.local === "r") {
      const hidden = hiddenProperty(tag, local);
      if (hidden !== undefined) {
        grandparent.hidden = grandparent.hidden || hidden;
      } else if (local === "rStyle") {
        grandparent.style = attribute(tag.attrs, "val");
      }
    } else if (
      parent?.local === "pPr" &&
      grandparent?.local === "p" &&
      local === "pStyle"
    ) {
      grandparent.style = attribute(tag.attrs, "val");
    }
    if (tag.kind === "open") {
      stack.push({ name: tag.name, local, start: tag.start });
    }
  }

  if (removed.length === 0) return documentXml;
  removed.sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [start, end] of removed) {
    if (start < cursor) continue; // inside a run already removed
    out += documentXml.slice(cursor, start);
    cursor = end;
  }
  return out + documentXml.slice(cursor);
}
