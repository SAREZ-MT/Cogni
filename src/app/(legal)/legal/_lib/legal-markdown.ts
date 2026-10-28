import { type LegalPageSlug, legalPage } from "./legal-documents";
import { readLegalSource } from "./legal-sources";

// Turns the legal markdown sources into page parts. The wording is never
// touched: only the document header (title + metadata list) is lifted out
// so the page can show it once, and merged sources get their headings
// shifted one level down under a stable anchor.

export type LegalMetadata = {
  version: string;
  effectiveFrom: string;
  responsible: string;
};

export type LegalIndexEntry = { id: string; label: string };

export type LegalSection = {
  key: string;
  markdown: string;
  // Present on merged sources: the h1 becomes an h2 with this id.
  anchor?: string;
};

export type BuiltLegalPage = {
  title: string;
  metadata: LegalMetadata;
  sections: LegalSection[];
  index: LegalIndexEntry[];
};

type ParsedSource = {
  title: string;
  metadata: LegalMetadata;
  body: string;
};

const METADATA_LINE = /^- \*\*([^*]+):\*\*\s*(.*)$/;

export function parseLegalSource(markdown: string): ParsedSource {
  const lines = markdown.split("\n");
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  if (titleIndex === -1) throw new Error("Legal source without a # title");
  const title = lines[titleIndex].slice(2).trim();

  const fields = new Map<string, string>();
  let cursor = titleIndex + 1;
  while (cursor < lines.length) {
    const line = lines[cursor];
    const match = METADATA_LINE.exec(line);
    if (match) fields.set(match[1].trim(), match[2].trim());
    else if (line.trim() !== "") break;
    cursor += 1;
  }

  return {
    title,
    metadata: {
      version: fields.get("Versión") ?? "",
      effectiveFrom: fields.get("Fecha de última actualización") ?? "",
      responsible: fields.get("Responsable") ?? "",
    },
    body: lines.slice(cursor).join("\n").trim(),
  };
}

export function sliceByHeading(
  body: string,
  { from, until }: { from?: string; until?: string },
): string {
  const lines = body.split("\n");
  const start = from ? lines.findIndex((line) => line.startsWith(from)) : 0;
  if (start === -1) throw new Error(`Heading not found: ${from}`);
  const endOffset = until
    ? lines.slice(start).findIndex((line) => line.startsWith(until))
    : -1;
  if (until && endOffset === -1) throw new Error(`Heading not found: ${until}`);
  const end = endOffset === -1 ? lines.length : start + endOffset;
  return lines.slice(start, end).join("\n").trim();
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The id a heading gets on the page; shared by the index and the renderer
// so every index link has a matching target.
export function headingId(text: string, anchor?: string): string {
  const slug = slugify(text);
  return anchor ? `${anchor}-${slug}` : slug;
}

function plainHeadingText(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/[*_`]/g, "")
    .trim();
}

export function buildLegalPage(slug: LegalPageSlug): BuiltLegalPage {
  const definition = legalPage(slug);
  const [first] = definition.parts;
  const main = parseLegalSource(readLegalSource(first.source));

  const sections: LegalSection[] = [];
  const index: LegalIndexEntry[] = [];

  definition.parts.forEach((part, position) => {
    const parsed =
      position === 0 ? main : parseLegalSource(readLegalSource(part.source));
    const body = sliceByHeading(parsed.body, part);

    if (part.anchor) {
      // The merged document keeps its own title as the section heading.
      sections.push({
        key: `${part.source}-${position}`,
        anchor: part.anchor,
        markdown: `# ${parsed.title}\n\n${body}`,
      });
      index.push({ id: part.anchor, label: parsed.title });
      return;
    }

    sections.push({ key: `${part.source}-${position}`, markdown: body });
    for (const line of body.split("\n")) {
      if (!line.startsWith("## ")) continue;
      const label = plainHeadingText(line);
      index.push({ id: headingId(label), label });
    }
  });

  return { title: main.title, metadata: main.metadata, sections, index };
}

const PENDING = /\[PENDIENTE:[^\]]*\]/g;

export type TextChunk = { text: string; pending: boolean };

// Splits a text run so every `[PENDIENTE: …]` placeholder can be marked.
export function splitPending(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let last = 0;
  for (const match of text.matchAll(PENDING)) {
    const start = match.index ?? 0;
    if (start > last)
      chunks.push({ text: text.slice(last, start), pending: false });
    chunks.push({ text: match[0], pending: true });
    last = start + match[0].length;
  }
  if (last < text.length)
    chunks.push({ text: text.slice(last), pending: false });
  return chunks;
}
