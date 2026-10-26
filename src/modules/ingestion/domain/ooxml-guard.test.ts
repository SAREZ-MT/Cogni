import { describe, expect, it } from "vitest";
import { countStringScans } from "../application/testing/count-string-scans";
import { makeZip, textEntry } from "../application/testing/make-zip";
import { DOCUMENT_FILE_ERROR } from "./errors";
import { inspectOoxmlPackage, OOXML_LIMITS, xmlShape } from "./ooxml-guard";

const MiB = 1024 * 1024;

const basic = [
  textEntry("[Content_Types].xml", "<Types/>"),
  textEntry("word/document.xml", "<w:document/>"),
];

function rejectionCode(bytes: Uint8Array): string | null {
  const result = inspectOoxmlPackage(bytes);
  return result.ok ? null : result.error.code;
}

describe("inspectOoxmlPackage", () => {
  it("lists the entries of a well-formed package with their sizes", () => {
    const result = inspectOoxmlPackage(makeZip(basic));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((entry) => entry.name)).toEqual([
      "[Content_Types].xml",
      "word/document.xml",
    ]);
    expect(result.value[1].uncompressedSize).toBe(13);
    expect(result.value[1].method).toBe(8);
  });

  it("rejects bytes whose central directory cannot be read", () => {
    expect(rejectionCode(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).toBe(
      DOCUMENT_FILE_ERROR.UNREADABLE,
    );
  });

  it("rejects more entries than the cap", () => {
    const many = Array.from({ length: OOXML_LIMITS.maxEntries + 1 }, (_, i) =>
      textEntry(`customXml/item${i}.xml`, "<a/>"),
    );
    expect(rejectionCode(makeZip([...basic, ...many]))).toBe(
      DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED,
    );
  });

  it("rejects a part that declares more than the per-part cap", () => {
    const entry = {
      ...textEntry("word/document.xml", "<w:document/>"),
      declaredSize: OOXML_LIMITS.maxPartBytes + 1,
    };
    expect(rejectionCode(makeZip([basic[0], entry]))).toBe(
      DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED,
    );
  });

  it("lets an oversized image through the guard (the extractor skips it) up to the part cap", () => {
    const image = (declaredSize: number) => ({
      name: "word/media/image1.png",
      data: new Uint8Array(0),
      compressed: new Uint8Array(declaredSize / 50),
      declaredSize,
    });
    expect(
      rejectionCode(
        makeZip([...basic, image(OOXML_LIMITS.maxImageBytes * 1.2)]),
      ),
    ).toBeNull();
    expect(
      rejectionCode(makeZip([...basic, image(OOXML_LIMITS.maxPartBytes + 50)])),
    ).toBe(DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED);
  });

  it("rejects a package whose parts together declare more than the total cap", () => {
    const parts = Array.from({ length: 4 }, (_, i) => ({
      name: `customXml/item${i}.xml`,
      data: new Uint8Array(0),
      compressed: new Uint8Array(1 * MiB),
      declaredSize: 40 * MiB,
    }));
    expect(rejectionCode(makeZip([...basic, ...parts]))).toBe(
      DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED,
    );
  });

  it("rejects a large entry compressed beyond the ratio cap (a zip bomb)", () => {
    const bomb = {
      name: "word/document.xml",
      data: new Uint8Array(0),
      compressed: new Uint8Array(10 * 1024),
      declaredSize: 10 * MiB,
    };
    expect(rejectionCode(makeZip([basic[0], bomb]))).toBe(
      DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED,
    );
  });

  it("accepts a small entry with a high ratio (tiny XML compresses well)", () => {
    const entry = {
      name: "word/settings.xml",
      data: new Uint8Array(0),
      compressed: new Uint8Array(10),
      declaredSize: 64 * 1024,
    };
    expect(rejectionCode(makeZip([...basic, entry]))).toBeNull();
  });

  it("rejects encrypted entries, unknown methods, zip64 sizes and duplicates", () => {
    expect(
      rejectionCode(makeZip([...basic, { ...basic[1], name: "a", flags: 1 }])),
    ).toBe(DOCUMENT_FILE_ERROR.UNREADABLE);
    const lzma = { ...textEntry("b.xml", "x"), method: 0 as const };
    const bytes = makeZip([...basic, lzma]);
    // Patch the central directory's method field of the last entry to 14.
    const view = new DataView(bytes.buffer);
    let central = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x02014b50) {
        central = i;
        break;
      }
    }
    view.setUint16(central + 10, 14, true);
    expect(rejectionCode(bytes)).toBe(DOCUMENT_FILE_ERROR.UNREADABLE);
    expect(
      rejectionCode(
        makeZip([
          ...basic,
          {
            name: "c.xml",
            data: new Uint8Array(0),
            compressed: new Uint8Array(4),
            declaredSize: 0xffffffff,
          },
        ]),
      ),
    ).toBe(DOCUMENT_FILE_ERROR.UNREADABLE);
    expect(rejectionCode(makeZip([...basic, basic[1]]))).toBe(
      DOCUMENT_FILE_ERROR.UNREADABLE,
    );
  });

  it("rejects an entry whose data lies outside the archive", () => {
    const bytes = makeZip(basic);
    const view = new DataView(bytes.buffer);
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 42, bytes.length + 10, true); // local header offset
        break;
      }
    }
    expect(rejectionCode(bytes)).toBe(DOCUMENT_FILE_ERROR.UNREADABLE);
  });

  // T10: deterministic instead of a wall-clock bound — the guard decides
  // at the first oversized entry (it never walks the other 1,499, and it
  // has no inflater to call: it only reads the directory).
  it("decides on a terabyte-declaring directory at its first oversized entry", () => {
    const parts = Array.from({ length: 1500 }, (_, i) => ({
      name: `word/media/x${i}.bin`,
      data: new Uint8Array(0),
      compressed: new Uint8Array(1000),
      declaredSize: 4_000_000_000,
    }));
    const result = inspectOoxmlPackage(makeZip([...basic, ...parts]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED);
    expect(result.error.message).toBe("part word/media/x0.bin too large");
  });
});

describe("xmlShape", () => {
  it("counts elements and the deepest nesting, ignoring declarations, comments and CDATA", () => {
    expect(
      xmlShape(
        '<?xml version="1.0"?><!-- <x> --><a b="1 > 0"><b/><c><![CDATA[<d>]]></c></a>',
      ),
    ).toEqual({ elements: 3, depth: 2 });
  });

  // T10: linearity proven by counting the characters scanned (see
  // countStringScans), not by a wall-clock bound; the test timeout is only
  // a safety net.
  it("is linear on a flat flood of empty elements", () => {
    const flood = "<a/>".repeat(1_000_000);
    const { result, scanned } = countStringScans(() => xmlShape(flood));
    expect(result).toEqual({ elements: 1_000_000, depth: 1 });
    expect(scanned).toBeLessThanOrEqual(2 * flood.length);
  }, 30_000);

  it("measures deep nesting", () => {
    const deep = "<a>".repeat(500) + "</a>".repeat(500);
    expect(xmlShape(deep).depth).toBe(500);
  });
});
