import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { makeZip, textEntry } from "../application/testing/make-zip";
import { OOXML_LIMITS } from "../domain/ooxml-guard";
import { readZipDirectory } from "../domain/zip-directory";
import { OoxmlLimitError, openOoxmlPackage } from "./ooxml-package";

const MiB = 1024 * 1024;

// 64 MiB of zeros deflate to ~64 KiB: built once, reused by every bomb.
const ZEROS = 64 * MiB;
const BOMB = deflateRawSync(Buffer.alloc(ZEROS));

const basic = [
  textEntry("[Content_Types].xml", "<Types/>"),
  textEntry("word/document.xml", "<w:document><w:body/></w:document>"),
];

function open(bytes: Uint8Array) {
  const opened = openOoxmlPackage(bytes);
  if (!opened.ok) throw new Error(opened.error.message);
  return opened.value;
}

describe("openOoxmlPackage", () => {
  it("reads stored and deflated parts as text or bytes", () => {
    const pkg = open(
      makeZip([
        ...basic,
        { name: "word/media/a.png", data: Uint8Array.of(1, 2, 3), method: 0 },
      ]),
    );
    expect(pkg.readText("word/document.xml")).toBe(
      "<w:document><w:body/></w:document>",
    );
    expect([...pkg.readBytes("word/media/a.png")]).toEqual([1, 2, 3]);
    expect(pkg.has("word/styles.xml")).toBe(false);
  });

  it("refuses the package when the guard rejects its directory", () => {
    const opened = openOoxmlPackage(
      makeZip([
        basic[0],
        {
          name: "word/document.xml",
          data: new Uint8Array(0),
          compressed: BOMB,
          declaredSize: ZEROS,
        },
      ]),
    );
    expect(opened.ok).toBe(false);
  });

  it("stops inflating a part that lies about its size, without allocating it", () => {
    const pkg = open(
      makeZip([
        basic[0],
        {
          name: "word/document.xml",
          data: new Uint8Array(0),
          compressed: BOMB,
          // Declares 100 KiB: under every cap and ratio of the guard.
          declaredSize: 100 * 1024,
        },
      ]),
    );
    const heapBefore = process.memoryUsage().arrayBuffers;
    const started = performance.now();
    expect(() => pkg.readText("word/document.xml")).toThrow(OoxmlLimitError);
    expect(performance.now() - started).toBeLessThan(1000);
    // Far below the 64 MiB the stream would inflate to.
    expect(process.memoryUsage().arrayBuffers - heapBefore).toBeLessThan(
      16 * MiB,
    );
  });

  it("never yields more bytes than a part declares, whatever its stream holds", () => {
    const limits = { ...OOXML_LIMITS, maxTotalBytes: 2 * MiB };
    const chunk = Buffer.alloc(1.5 * MiB, 0x61);
    const bytes = makeZip([
      ...basic,
      { name: "word/a.xml", data: chunk, declaredSize: 1 },
    ]);
    // The guard accepts the forged declaration of 1 byte …
    const opened = openOoxmlPackage(bytes, limits);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    // … but the inflater never yields more than declared.
    expect(() => opened.value.readText("word/a.xml")).toThrow(OoxmlLimitError);
  });

  it("refuses XML with too many elements or nesting too deep", () => {
    const limits = { ...OOXML_LIMITS, maxXmlElements: 1000, maxXmlDepth: 20 };
    const flood = makeZip([
      basic[0],
      textEntry("word/document.xml", "<a/>".repeat(1001)),
    ]);
    const deep = makeZip([
      basic[0],
      textEntry("word/document.xml", "<a>".repeat(21) + "</a>".repeat(21)),
    ]);
    for (const bytes of [flood, deep]) {
      const opened = openOoxmlPackage(bytes, limits);
      if (!opened.ok) throw new Error("guard");
      expect(() => opened.value.readText("word/document.xml")).toThrow(
        OoxmlLimitError,
      );
    }
  });

  // document-import T10 (T9b review: shapeChecked latched before the
  // verdict): a part that failed the shape check must fail every read,
  // not pass unchecked the second time.
  it("refuses a too-deep part on every read, not only the first", () => {
    const limits = { ...OOXML_LIMITS, maxXmlDepth: 20 };
    const opened = openOoxmlPackage(
      makeZip([
        basic[0],
        textEntry("word/document.xml", "<a>".repeat(21) + "</a>".repeat(21)),
      ]),
      limits,
    );
    if (!opened.ok) throw new Error("guard");
    expect(() => opened.value.readText("word/document.xml")).toThrow(
      OoxmlLimitError,
    );
    expect(() => opened.value.readText("word/document.xml")).toThrow(
      OoxmlLimitError,
    );
  });

  it("counts a passing part's elements once however often it is read", () => {
    const limits = { ...OOXML_LIMITS, maxXmlElements: 15 };
    const opened = openOoxmlPackage(
      makeZip([basic[0], textEntry("word/document.xml", "<a/>".repeat(10))]),
      limits,
    );
    if (!opened.ok) throw new Error("guard");
    opened.value.readText("word/document.xml");
    expect(() => opened.value.readText("word/document.xml")).not.toThrow();
  });

  it("refuses a media part over the image cap at read time, before inflating it", () => {
    const image = Buffer.alloc(OOXML_LIMITS.maxImageBytes + 1, 7);
    const pkg = open(
      makeZip([
        ...basic,
        { name: "word/media/big.png", data: image, method: 0 },
      ]),
    );
    expect(() => pkg.readBytes("word/media/big.png")).toThrow(OoxmlLimitError);
  });

  it("serves parts to mammoth through its zip-file interface", async () => {
    const pkg = open(makeZip(basic));
    const file = pkg.mammothFile();
    expect(file.exists("word/document.xml")).toBe(true);
    expect(file.exists("word/missing.xml")).toBe(false);
    await expect(file.read("word/document.xml", "utf-8")).resolves.toContain(
      "<w:body/>",
    );
    await expect(file.read("word/missing.xml")).rejects.toThrow();
  });

  it("uses a replaced part instead of the archived one", () => {
    const pkg = open(makeZip(basic));
    pkg.replaceText("word/document.xml", "<w:document/>");
    expect(pkg.readText("word/document.xml")).toBe("<w:document/>");
  });

  it("rebuilds a stored archive of the XML parts only (for officeparser)", () => {
    const pkg = open(
      makeZip([
        ...basic,
        { name: "word/media/a.png", data: Uint8Array.of(1, 2, 3) },
      ]),
    );
    pkg.replaceText("word/document.xml", "<w:document/>");
    const rebuilt = pkg.xmlArchive();
    const entries = readZipDirectory(rebuilt);
    expect(entries?.map((entry) => entry.name)).toEqual([
      "[Content_Types].xml",
      "word/document.xml",
    ]);
    expect(entries?.every((entry) => entry.method === 0)).toBe(true);
    const reopened = open(rebuilt);
    expect(reopened.readText("word/document.xml")).toBe("<w:document/>");
  });
});
