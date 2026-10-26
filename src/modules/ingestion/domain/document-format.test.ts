import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type DetectedFormat,
  DOCUMENT_FORMATS,
  detectDocumentFormat,
} from "./document-format";

// T1 golden fixtures (tests/fixtures/documents/README.md): real files, so
// detection is proven against what officeparser/mammoth will receive, not
// against hand-made headers only.
const FIXTURES = join(process.cwd(), "tests/fixtures/documents/files");

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

const ascii = (text: string) => new TextEncoder().encode(text);

// A minimal stored (uncompressed) ZIP whose entries carry the given names,
// with a real central directory and end-of-central-directory record.
function makeZip(
  names: string[],
  options: { centralDirectory?: boolean; comment?: number[] } = {},
) {
  const parts: number[] = [];
  const central: number[] = [];
  const u16 = (out: number[], v: number) => out.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (out: number[], v: number) =>
    out.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  for (const name of names) {
    const offset = parts.length;
    const nameBytes = [...ascii(name)];
    u32(parts, 0x04034b50);
    for (let i = 0; i < 22; i++) parts.push(0); // version..uncompressed size
    u16(parts, nameBytes.length);
    u16(parts, 0);
    parts.push(...nameBytes);
    u32(central, 0x02014b50);
    for (let i = 0; i < 24; i++) central.push(0); // versions..uncompressed size
    u16(central, nameBytes.length);
    u16(central, 0); // extra
    u16(central, 0); // comment
    u16(central, 0); // disk
    u16(central, 0); // internal attrs
    u32(central, 0); // external attrs
    u32(central, offset);
    central.push(...nameBytes);
  }
  if (options.centralDirectory === false) return new Uint8Array(parts);
  const centralOffset = parts.length;
  parts.push(...central);
  u32(parts, 0x06054b50);
  u16(parts, 0);
  u16(parts, 0);
  u16(parts, names.length);
  u16(parts, names.length);
  u32(parts, central.length);
  u32(parts, centralOffset);
  const comment = options.comment ?? [];
  u16(parts, comment.length);
  parts.push(...comment);
  return new Uint8Array(parts);
}

describe("DOCUMENT_FORMATS", () => {
  it("lists exactly the three importable formats", () => {
    expect(DOCUMENT_FORMATS).toEqual(["pdf", "docx", "pptx"]);
  });
});

describe("detectDocumentFormat (T1 fixtures)", () => {
  const cases: Array<[string, DetectedFormat]> = [
    ["tagged.pdf", "pdf"],
    ["untagged.pdf", "pdf"],
    ["scanned.pdf", "pdf"],
    // Starts with %PDF- but is unreadable: detection says pdf, the
    // extractor then fails it as invalid_document.
    ["corrupt.pdf", "pdf"],
    ["all-constructs.docx", "docx"],
    ["large-30p.docx", "docx"],
    // Truncated ZIP with no central directory: still recognised from its
    // local file headers so the extractor (not detection) rejects it.
    ["corrupt.docx", "docx"],
    ["all-constructs.pptx", "pptx"],
    ["large-40s.pptx", "pptx"],
    ["legacy.doc", "legacy"],
    ["garbage.bin", "unknown"],
  ];

  it.each(cases)("detects %s as %s", (name, expected) => {
    expect(detectDocumentFormat(fixture(name))).toBe(expected);
  });
});

describe("detectDocumentFormat (synthetic bytes)", () => {
  it("returns unknown for empty or too-short input", () => {
    expect(detectDocumentFormat(new Uint8Array())).toBe("unknown");
    expect(detectDocumentFormat(ascii("%PD"))).toBe("unknown");
    expect(detectDocumentFormat(new Uint8Array([0x50, 0x4b]))).toBe("unknown");
  });

  it("requires [Content_Types].xml next to word/document.xml for docx", () => {
    expect(
      detectDocumentFormat(
        makeZip(["[Content_Types].xml", "word/document.xml"]),
      ),
    ).toBe("docx");
    expect(detectDocumentFormat(makeZip(["word/document.xml"]))).toBe(
      "unknown",
    );
  });

  it("requires [Content_Types].xml next to ppt/presentation.xml for pptx", () => {
    expect(
      detectDocumentFormat(
        makeZip(["[Content_Types].xml", "ppt/presentation.xml"]),
      ),
    ).toBe("pptx");
    expect(detectDocumentFormat(makeZip(["ppt/presentation.xml"]))).toBe(
      "unknown",
    );
  });

  it("returns unknown for a ZIP that is neither (e.g. an xlsx or a plain archive)", () => {
    expect(
      detectDocumentFormat(makeZip(["[Content_Types].xml", "xl/workbook.xml"])),
    ).toBe("unknown");
    expect(detectDocumentFormat(makeZip(["notes.txt"]))).toBe("unknown");
  });

  it("falls back to local file headers when the central directory is missing", () => {
    expect(
      detectDocumentFormat(
        makeZip(["[Content_Types].xml", "ppt/presentation.xml"], {
          centralDirectory: false,
        }),
      ),
    ).toBe("pptx");
  });

  it("judges a truncated archive by its main part alone ([Content_Types].xml may come last)", () => {
    expect(
      detectDocumentFormat(
        makeZip(["word/_rels/document.xml.rels", "word/document.xml"], {
          centralDirectory: false,
        }),
      ),
    ).toBe("docx");
    expect(
      detectDocumentFormat(makeZip(["notes.txt"], { centralDirectory: false })),
    ).toBe("unknown");
  });

  // T5 review suggestion (folded into T6): a ZIP comment may itself hold
  // the EOCD signature. The backward search must skip such an invalid
  // candidate and keep looking for the real record, instead of giving up
  // and judging the archive by its local headers (which would accept a
  // package without [Content_Types].xml as docx).
  it("keeps searching backwards past an invalid end-of-central-directory candidate", () => {
    const fakeEocd = [0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 1, 0, 1, 0];
    fakeEocd.push(0, 0, 0, 0, 0xf0, 0xff, 0xff, 0xff, 0, 0);
    expect(
      detectDocumentFormat(
        makeZip(["word/document.xml"], { comment: fakeEocd }),
      ),
    ).toBe("unknown");
    expect(
      detectDocumentFormat(
        makeZip(["[Content_Types].xml", "word/document.xml"], {
          comment: fakeEocd,
        }),
      ),
    ).toBe("docx");
  });

  it("never throws on a ZIP signature followed by garbage", () => {
    const bytes = new Uint8Array(64).fill(0xff);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    expect(detectDocumentFormat(bytes)).toBe("unknown");
  });

  it("detects the OLE2 header of legacy .doc/.ppt as legacy", () => {
    expect(
      detectDocumentFormat(
        new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      ),
    ).toBe("legacy");
  });
});
