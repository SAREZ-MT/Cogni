import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import mammoth from "mammoth";
import { OfficeParser } from "officeparser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeZip, type ZipTestEntry } from "../application/testing/make-zip";
import { OOXML_LIMITS } from "../domain/ooxml-guard";
import { DocxDocumentExtractor } from "./docx-document-extractor";
import { openOoxmlPackage } from "./ooxml-package";

// document-import T9b (security audit, zip bomb): the DOCX adapter refuses
// a package that declares or inflates past the caps before mammoth or
// officeparser allocate it, and runs the two engines one after the other.
const MiB = 1024 * 1024;
const fixture = new Uint8Array(
  readFileSync(
    join(process.cwd(), "tests/fixtures/documents/files/all-constructs.docx"),
  ),
);

// The fixture's own parts, re-zipped, with `replace` overriding entries.
function repack(replace: Record<string, ZipTestEntry>): Uint8Array {
  const opened = openOoxmlPackage(fixture);
  if (!opened.ok) throw new Error("fixture");
  const pkg = opened.value;
  const entries = pkg
    .names()
    .map((name) => replace[name] ?? { name, data: pkg.readBytes(name) });
  return makeZip(entries);
}

// 200 MiB of zeros deflate to ~200 KiB.
const BOMB = deflateRawSync(Buffer.alloc(200 * MiB));

afterEach(() => vi.restoreAllMocks());

describe("DocxDocumentExtractor limits", () => {
  it("still reads the fixture once re-zipped (the repack itself is faithful)", async () => {
    const result = await new DocxDocumentExtractor().extract(
      repack({}),
      "docx",
    );
    expect(result.ok).toBe(true);
  });

  it("refuses an honest zip bomb from its directory, before any parser runs", async () => {
    const convert = vi.spyOn(mammoth, "convertToHtml");
    const parse = vi.spyOn(OfficeParser, "parseOffice");
    const bytes = repack({
      "word/document.xml": {
        name: "word/document.xml",
        data: new Uint8Array(0),
        compressed: BOMB,
        declaredSize: 200 * MiB,
      },
    });
    const started = performance.now();
    const result = await new DocxDocumentExtractor().extract(bytes, "docx");
    expect(performance.now() - started).toBeLessThan(1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
    expect(convert).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it("refuses a bomb whose directory lies about its size, without inflating it", async () => {
    const parse = vi.spyOn(OfficeParser, "parseOffice");
    const bytes = repack({
      "word/document.xml": {
        name: "word/document.xml",
        data: new Uint8Array(0),
        compressed: BOMB,
        declaredSize: 512 * 1024,
      },
    });
    const before = process.memoryUsage().arrayBuffers;
    const started = performance.now();
    const result = await new DocxDocumentExtractor().extract(bytes, "docx");
    expect(performance.now() - started).toBeLessThan(1000);
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(50 * MiB);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
    expect(parse).not.toHaveBeenCalled();
  });

  it("refuses an XML element flood (a small zip of empty elements)", async () => {
    const flood = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${"<w:p/>".repeat(OOXML_LIMITS.maxXmlElements + 1)}</w:body></w:document>`;
    const bytes = repack({
      "word/document.xml": {
        name: "word/document.xml",
        data: new TextEncoder().encode(flood),
      },
    });
    const result = await new DocxDocumentExtractor().extract(bytes, "docx");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
  });

  it("runs officeparser only after mammoth finished, on a stored XML-only archive with limits", async () => {
    let mammothDone = false;
    const convert = mammoth.convertToHtml.bind(mammoth);
    vi.spyOn(mammoth, "convertToHtml").mockImplementation(
      async (...args: Parameters<typeof mammoth.convertToHtml>) => {
        const result = await convert(...args);
        mammothDone = true;
        return result;
      },
    );
    const parse = OfficeParser.parseOffice.bind(OfficeParser);
    const seen: { mammothDone: boolean; config?: unknown; size: number }[] = [];
    vi.spyOn(OfficeParser, "parseOffice").mockImplementation((async (
      input: Buffer,
      config: unknown,
    ) => {
      seen.push({ mammothDone, config, size: input.length });
      return parse(input, config as never);
    }) as never);

    const result = await new DocxDocumentExtractor().extract(fixture, "docx");

    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].mammothDone).toBe(true);
    expect(seen[0].config).toMatchObject({
      decompressionLimits: {
        maxUncompressedBytes: OOXML_LIMITS.maxTotalBytes,
        maxZipEntries: OOXML_LIMITS.maxEntries,
        maxXmlElements: OOXML_LIMITS.maxXmlElements,
      },
    });
  });

  it("does not start the engines once the time budget aborted the signal", async () => {
    const convert = vi.spyOn(mammoth, "convertToHtml");
    const controller = new AbortController();
    controller.abort();

    const result = await new DocxDocumentExtractor().extract(fixture, "docx", {
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_UNREADABLE");
    expect(convert).not.toHaveBeenCalled();
  });
});
