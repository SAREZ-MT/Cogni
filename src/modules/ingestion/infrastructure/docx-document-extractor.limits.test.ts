import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { Document, ImageRun, Packer, Paragraph } from "docx";
import mammoth from "mammoth";
import { OfficeParser } from "officeparser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeZip, type ZipTestEntry } from "../application/testing/make-zip";
import { OOXML_LIMITS } from "../domain/ooxml-guard";
import { DocxDocumentExtractor } from "./docx-document-extractor";
import { OoxmlLimitError, openOoxmlPackage } from "./ooxml-package";

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

  // document-import T10 (T9b review): an image declaring more than the
  // image cap drops that image (counted), never the whole document. The
  // DOCX is built in the test with two distinct PNGs; the second one's
  // media part is then replaced by one declared just over the cap.
  it("skips and counts an embedded image declared over the image cap, importing the rest", async () => {
    const opened = openOoxmlPackage(fixture);
    if (!opened.ok) throw new Error("fixture");
    const fixturePng = opened.value
      .names()
      .find((name) => /^word\/media\/.+\.png$/.test(name));
    if (!fixturePng) throw new Error("fixture has no png");
    const small = opened.value.readBytes(fixturePng);
    const other = Uint8Array.from([...small, 0]);
    const image = (data: Uint8Array) =>
      new ImageRun({
        type: "png",
        data,
        transformation: { width: 10, height: 10 },
      });
    const built = new Uint8Array(
      await Packer.toBuffer(
        new Document({
          sections: [
            {
              children: [
                new Paragraph({ children: [image(small)] }),
                new Paragraph({ children: [image(other)] }),
                new Paragraph("Texto después de las imágenes."),
              ],
            },
          ],
        }),
      ),
    );
    const pkg = openOoxmlPackage(built);
    if (!pkg.ok) throw new Error("built docx");
    const otherPart = pkg.value
      .names()
      .find(
        (name) =>
          name.includes("/media/") &&
          pkg.value.readBytes(name).length === other.length,
      );
    if (!otherPart) throw new Error("second image part");
    const oversized = new Uint8Array(OOXML_LIMITS.maxImageBytes + 1);
    oversized.set(other);
    const bytes = makeZip(
      pkg.value
        .names()
        .map((name) =>
          name === otherPart
            ? { name, data: oversized, method: 0 as const }
            : { name, data: pkg.value.readBytes(name) },
        ),
    );

    const result = await new DocxDocumentExtractor().extract(bytes, "docx");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.images).toHaveLength(1);
    expect(result.value.images[0]?.bytes).toEqual(small);
    expect(result.value.skippedImages).toBe(1);
    expect(JSON.stringify(result.value.content)).toContain(
      "Texto después de las imágenes.",
    );
  });

  // document-import T10 (T9b review: the enrichment catch-all swallowed
  // limit breaches). The caps are security bounds: a breach found while
  // building officeparser's archive fails the import; any other
  // officeparser failure still imports from mammoth alone.
  it("fails with LIMIT_EXCEEDED when a part only officeparser reads breaches a cap", async () => {
    const deep = `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${"<a:x>".repeat(OOXML_LIMITS.maxXmlDepth + 1)}${"</a:x>".repeat(OOXML_LIMITS.maxXmlDepth + 1)}</a:theme>`;
    const bytes = repack({
      "word/theme/theme1.xml": {
        name: "word/theme/theme1.xml",
        data: new TextEncoder().encode(deep),
      },
    });

    const result = await new DocxDocumentExtractor().extract(bytes, "docx");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
  });

  it("fails with LIMIT_EXCEEDED when officeparser itself raises a limit error", async () => {
    vi.spyOn(OfficeParser, "parseOffice").mockRejectedValueOnce(
      new OoxmlLimitError("too many XML elements"),
    );

    const result = await new DocxDocumentExtractor().extract(fixture, "docx");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
  });

  it.each([
    "ZIP_SIZE_LIMIT_EXCEEDED",
    "ZIP_ENTRY_COUNT_LIMIT_EXCEEDED",
    "XML_ELEMENT_LIMIT_EXCEEDED",
    "MAX_NESTING_DEPTH_EXCEEDED",
  ])("fails with LIMIT_EXCEEDED on officeparser's own %s", async (code) => {
    vi.spyOn(OfficeParser, "parseOffice").mockRejectedValueOnce(
      Object.assign(new Error(`[OfficeParser]: ${code}`), {
        officeIssue: { code },
      }),
    );

    const result = await new DocxDocumentExtractor().extract(fixture, "docx");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DOCUMENT_LIMIT_EXCEEDED");
  });

  it("still imports from mammoth alone when officeparser fails for another reason", async () => {
    vi.spyOn(OfficeParser, "parseOffice").mockRejectedValueOnce(
      new Error("unexpected AST"),
    );

    const result = await new DocxDocumentExtractor().extract(fixture, "docx");

    expect(result.ok).toBe(true);
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
