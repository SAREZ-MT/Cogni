import { crc32, inflateRawSync } from "node:zlib";
import type { DomainError } from "@/shared/kernel/domain-error";
import { ok, type Result } from "@/shared/kernel/result";
import {
  inspectOoxmlPackage,
  isMediaPart,
  OOXML_LIMITS,
  type OoxmlLimits,
  xmlShape,
} from "../domain/ooxml-guard";
import { u16, type ZipEntry } from "../domain/zip-directory";

// document-import T9b (security audit 2026-10-26, zip bomb): an OOXML
// package whose parts are inflated by Cogni itself, with hard caps, before
// any parser sees them.
//
// Why not just a limit option: officeparser has one
// (`decompressionLimits.maxUncompressedBytes`, also passed), but mammoth
// 1.13 inflates with JSZip and no cap at all. mammoth's `openZip` accepts a
// ready zip-file object (`{ file }`, mammoth/lib/unzip.js: `exists`,
// `read(name, encoding)`), so mammoth reads every part through
// `mammothFile()` below and never inflates a byte itself. officeparser gets
// `xmlArchive()`: a rebuilt archive of the already-inflated XML parts,
// stored uncompressed, so it cannot inflate past what was checked either.
// No new dependency: `node:zlib`'s `inflateRawSync` with `maxOutputLength`
// stops a stream at its declared size (it throws instead of growing), so a
// part that lies about its size never allocates more than it declared.
//
// Caps (OOXML_LIMITS): per part, total, XML elements and nesting depth;
// media parts above the image cap are refused at read time so the mapper
// skips them. Parts are inflated lazily — a part nobody reads is never
// inflated — and non-media parts are cached so a second read is free.
export class OoxmlLimitError extends Error {
  constructor(reason: string) {
    super(`OOXML limit exceeded: ${reason}`);
    this.name = "OoxmlLimitError";
  }
}

const TEXT_PART = /\.(xml|rels)$/i;
const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

export type MammothZipFile = {
  exists(name: string): boolean;
  read(name: string, encoding?: string): Promise<Uint8Array | string>;
  write(name: string, contents: unknown): void;
  toArrayBuffer(): Promise<ArrayBuffer>;
};

export class OoxmlPackage {
  private readonly entries: Map<string, ZipEntry>;
  private readonly cache = new Map<string, Uint8Array>();
  private readonly replaced = new Map<string, Uint8Array>();
  private inflatedBytes = 0;
  private xmlElements = 0;
  private readonly shapeChecked = new Set<string>();

  constructor(
    private readonly bytes: Uint8Array,
    entries: readonly ZipEntry[],
    private readonly limits: OoxmlLimits,
  ) {
    this.entries = new Map(entries.map((entry) => [entry.name, entry]));
  }

  names(): string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  readBytes(name: string): Uint8Array {
    const replaced = this.replaced.get(name);
    if (replaced) return replaced;
    const cached = this.cache.get(name);
    if (cached) return cached;
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`no part ${name}`);
    const media = isMediaPart(name);
    const cap = media ? this.limits.maxImageBytes : this.limits.maxPartBytes;
    if (entry.uncompressedSize > cap) {
      throw new OoxmlLimitError(`part ${name} declares too much`);
    }
    if (
      this.inflatedBytes + entry.uncompressedSize >
      this.limits.maxTotalBytes
    ) {
      throw new OoxmlLimitError("total inflated size");
    }
    const data = this.inflate(entry);
    this.inflatedBytes += data.length;
    if (!media) this.cache.set(name, data);
    return data;
  }

  // UTF-8 text of an XML part, refused when it holds more elements (across
  // every part read so far) or deeper nesting than the caps. A part is
  // marked checked only once it passed (T10, T9b review), so a refused part
  // is refused again on every later read; its elements are counted once.
  readText(name: string): string {
    const text = decoder.decode(this.readBytes(name));
    if (
      TEXT_PART.test(name) &&
      !this.replaced.has(name) &&
      !this.shapeChecked.has(name)
    ) {
      const shape = xmlShape(text);
      const elements = this.xmlElements + shape.elements;
      if (elements > this.limits.maxXmlElements) {
        throw new OoxmlLimitError("too many XML elements");
      }
      if (shape.depth > this.limits.maxXmlDepth) {
        throw new OoxmlLimitError(`XML nesting in ${name}`);
      }
      this.xmlElements = elements;
      this.shapeChecked.add(name);
    }
    return text;
  }

  // A part rewritten by Cogni (hidden runs stripped) replaces the archived
  // one for every later reader.
  replaceText(name: string, text: string): void {
    this.replaced.set(name, encoder.encode(text));
  }

  mammothFile(): MammothZipFile {
    return {
      exists: (name) => this.has(name),
      read: async (name, encoding) => {
        if (!encoding) return this.readBytes(name);
        if (encoding === "base64") {
          return Buffer.from(this.readBytes(name)).toString("base64");
        }
        return this.readText(name);
      },
      // Only mammoth's embedStyleMap writes; the importer never calls it.
      write: () => {
        throw new Error("read-only package");
      },
      toArrayBuffer: () => Promise.reject(new Error("read-only package")),
    };
  }

  // Every XML/rels part (already inflated and checked, replacements
  // applied) in a new stored archive, in the original order. Media and
  // embedded objects are left out: officeparser only needs the markup.
  xmlArchive(): Uint8Array {
    const files: Array<{ name: Uint8Array; data: Uint8Array }> = [];
    for (const name of this.entries.keys()) {
      if (!TEXT_PART.test(name)) continue;
      const data =
        this.replaced.get(name) ?? encoder.encode(this.readText(name));
      files.push({ name: encoder.encode(name), data });
    }
    return storedZip(files);
  }

  private inflate(entry: ZipEntry): Uint8Array {
    const offset = entry.localHeaderOffset;
    const start =
      offset + 30 + u16(this.bytes, offset + 26) + u16(this.bytes, offset + 28);
    const end = start + entry.compressedSize;
    if (end > this.bytes.length) throw new Error("entry outside the archive");
    const raw = this.bytes.subarray(start, end);
    if (entry.method === 0) return raw;
    if (entry.uncompressedSize === 0) return new Uint8Array(0);
    let inflated: Buffer;
    try {
      inflated = inflateRawSync(raw, {
        maxOutputLength: entry.uncompressedSize,
      });
    } catch (error) {
      if (error instanceof RangeError) {
        throw new OoxmlLimitError(`part ${entry.name} inflates past its size`);
      }
      throw error;
    }
    if (inflated.length !== entry.uncompressedSize) {
      throw new Error(`part ${entry.name} is shorter than declared`);
    }
    return new Uint8Array(
      inflated.buffer,
      inflated.byteOffset,
      inflated.length,
    );
  }
}

// officeparser's own decompression-limit errors (shared by the DOCX and
// PPTX adapters) (`err.officeIssue.code`,
// officeparser/dist/types.js OfficeErrorType).
const OFFICEPARSER_LIMIT_CODES: ReadonlySet<string> = new Set([
  "ZIP_ENTRY_COUNT_LIMIT_EXCEEDED",
  "ZIP_ENTRY_INVALID_SIZE",
  "ZIP_SIZE_LIMIT_EXCEEDED",
  "XML_ELEMENT_LIMIT_EXCEEDED",
  "MAX_NESTING_DEPTH_EXCEEDED",
  "OUTPUT_TOO_LARGE",
]);

export function officeparserLimitCode(error: unknown): string | null {
  const code = (error as { officeIssue?: { code?: unknown } } | null)
    ?.officeIssue?.code;
  return typeof code === "string" && OFFICEPARSER_LIMIT_CODES.has(code)
    ? code
    : null;
}

// The checked package, or the guard's error (UNREADABLE/LIMIT_EXCEEDED).
export function openOoxmlPackage(
  bytes: Uint8Array,
  limits: OoxmlLimits = OOXML_LIMITS,
): Result<OoxmlPackage, DomainError> {
  const entries = inspectOoxmlPackage(bytes, limits);
  if (!entries.ok) return entries;
  return ok(new OoxmlPackage(bytes, entries.value, limits));
}

function storedZip(
  files: ReadonlyArray<{ name: Uint8Array; data: Uint8Array }>,
): Uint8Array {
  const size = files.reduce(
    (sum, file) => sum + 30 + 46 + 2 * file.name.length + file.data.length,
    22,
  );
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let at = 0;
  const records: Array<{ offset: number; crc: number }> = [];
  for (const file of files) {
    const crc = crc32(file.data);
    records.push({ offset: at, crc });
    view.setUint32(at, 0x04034b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint32(at + 14, crc, true);
    view.setUint32(at + 18, file.data.length, true);
    view.setUint32(at + 22, file.data.length, true);
    view.setUint16(at + 26, file.name.length, true);
    out.set(file.name, at + 30);
    out.set(file.data, at + 30 + file.name.length);
    at += 30 + file.name.length + file.data.length;
  }
  const centralStart = at;
  files.forEach((file, index) => {
    view.setUint32(at, 0x02014b50, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, 20, true);
    view.setUint32(at + 16, records[index].crc, true);
    view.setUint32(at + 20, file.data.length, true);
    view.setUint32(at + 24, file.data.length, true);
    view.setUint16(at + 28, file.name.length, true);
    view.setUint32(at + 42, records[index].offset, true);
    out.set(file.name, at + 46);
    at += 46 + file.name.length;
  });
  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, files.length, true);
  view.setUint16(at + 10, files.length, true);
  view.setUint32(at + 12, at - centralStart, true);
  view.setUint32(at + 16, centralStart, true);
  return out;
}
