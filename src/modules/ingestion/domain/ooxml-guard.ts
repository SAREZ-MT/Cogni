import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { DOCUMENT_FILE_ERROR } from "./errors";
import { readZipDirectory, u32, type ZipEntry } from "./zip-directory";

// document-import T9b (security audit 2026-10-26): what an OOXML package
// (DOCX today, PPTX in T7) may declare before any parser inflates one of
// its parts. A 20 MiB upload of highly compressible parts can otherwise
// inflate to gigabytes inside mammoth's JSZip and kill the 2 GB function.
//
// The declared sizes come from the central directory and can lie, so the
// infrastructure inflater (ooxml-package.ts) enforces the same caps on the
// bytes it actually inflates; this guard only rejects the honest bombs
// and malformed directories cheaply, without inflating anything.
const MiB = 1024 * 1024;

export const OOXML_LIMITS = {
  // A large Word document has a few hundred parts.
  maxEntries: 2000,
  // Any one non-media part (document.xml, styles.xml, …).
  maxPartBytes: 50 * MiB,
  // Any one media part (word/media/…): bigger images are skipped by the
  // extractor, never inflated past this.
  maxImageBytes: 10 * MiB,
  // Every part together.
  maxTotalBytes: 150 * MiB,
  // Uncompressed/compressed for entries of at least ratioMinBytes.
  // Word XML compresses ~10–30:1; zeros reach ~1000:1.
  maxRatio: 200,
  ratioMinBytes: 1 * MiB,
  // XML elements across every part read (an XML reader holds a few
  // hundred bytes per element) and the deepest nesting of one part.
  maxXmlElements: 1_000_000,
  maxXmlDepth: 256,
} as const;

export type OoxmlLimits = { readonly [K in keyof typeof OOXML_LIMITS]: number };

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP64_SENTINEL = 0xffffffff;
const ENCRYPTED_FLAG = 0x1;
const STORED = 0;
const DEFLATE = 8;

export function isMediaPart(name: string): boolean {
  return /^[^/]+\/media\//.test(name);
}

function unreadable(reason: string): Result<never, DomainError> {
  return err(new DomainError(DOCUMENT_FILE_ERROR.UNREADABLE, reason));
}

function limitExceeded(reason: string): Result<never, DomainError> {
  return err(new DomainError(DOCUMENT_FILE_ERROR.LIMIT_EXCEEDED, reason));
}

// The entries of an OOXML package, or err(UNREADABLE) for a directory that
// cannot be trusted (unreadable, encrypted or zip64 entries, unknown
// compression, duplicate names, data outside the archive) and
// err(LIMIT_EXCEEDED) for one that declares too much.
export function inspectOoxmlPackage(
  bytes: Uint8Array,
  limits: OoxmlLimits = OOXML_LIMITS,
): Result<ZipEntry[], DomainError> {
  const entries = readZipDirectory(bytes);
  if (!entries) return unreadable("no readable central directory");
  if (entries.length > limits.maxEntries) {
    return limitExceeded(`${entries.length} entries`);
  }
  const names = new Set<string>();
  let total = 0;
  for (const entry of entries) {
    if (names.has(entry.name)) return unreadable("duplicate entry");
    names.add(entry.name);
    if (entry.flags & ENCRYPTED_FLAG) return unreadable("encrypted entry");
    if (entry.method !== STORED && entry.method !== DEFLATE) {
      return unreadable("unsupported compression method");
    }
    if (
      entry.compressedSize === ZIP64_SENTINEL ||
      entry.uncompressedSize === ZIP64_SENTINEL ||
      entry.localHeaderOffset === ZIP64_SENTINEL
    ) {
      return unreadable("zip64 entry");
    }
    if (
      entry.localHeaderOffset + 30 > bytes.length ||
      u32(bytes, entry.localHeaderOffset) !== LOCAL_HEADER_SIGNATURE ||
      entry.localHeaderOffset + 30 + entry.compressedSize > bytes.length
    ) {
      return unreadable("entry outside the archive");
    }
    if (
      entry.method === STORED &&
      entry.compressedSize !== entry.uncompressedSize
    ) {
      return unreadable("stored entry with mismatched sizes");
    }
    // Media parts share the per-part cap here; the smaller image cap only
    // makes the extractor skip an image (requirement: a 12 MiB photo drops
    // the photo, not the document).
    if (entry.uncompressedSize > limits.maxPartBytes) {
      return limitExceeded(`part ${entry.name} too large`);
    }
    if (
      entry.uncompressedSize >= limits.ratioMinBytes &&
      entry.uncompressedSize >
        limits.maxRatio * Math.max(entry.compressedSize, 1)
    ) {
      return limitExceeded(`part ${entry.name} compression ratio`);
    }
    total += entry.uncompressedSize;
    if (total > limits.maxTotalBytes) {
      return limitExceeded("total uncompressed size");
    }
  }
  return ok(entries);
}

// Elements and deepest nesting of an XML text, in one linear pass that
// skips declarations, processing instructions, comments and CDATA and
// honours quoted attribute values (where `>` is legal). Approximate on
// malformed XML — it only bounds what a parser is then given.
export function xmlShape(xml: string): { elements: number; depth: number } {
  let elements = 0;
  let depth = 0;
  let deepest = 0;
  let index = 0;
  const length = xml.length;
  while (index < length) {
    const open = xml.indexOf("<", index);
    if (open === -1) break;
    const next = xml.charCodeAt(open + 1);
    if (next === 0x21 /* ! */) {
      if (xml.startsWith("<!--", open)) {
        const close = xml.indexOf("-->", open + 4);
        index = close === -1 ? length : close + 3;
      } else if (xml.startsWith("<![CDATA[", open)) {
        const close = xml.indexOf("]]>", open + 9);
        index = close === -1 ? length : close + 3;
      } else {
        const close = xml.indexOf(">", open + 2);
        index = close === -1 ? length : close + 1;
      }
      continue;
    }
    if (next === 0x3f /* ? */) {
      const close = xml.indexOf("?>", open + 2);
      index = close === -1 ? length : close + 2;
      continue;
    }
    if (next === 0x2f /* / */) {
      depth = Math.max(0, depth - 1);
      const close = xml.indexOf(">", open + 2);
      index = close === -1 ? length : close + 1;
      continue;
    }
    // A start tag: find its end outside quoted attribute values.
    let cursor = open + 1;
    let quote = 0;
    while (cursor < length) {
      const code = xml.charCodeAt(cursor);
      if (quote) {
        if (code === quote) quote = 0;
      } else if (code === 0x22 || code === 0x27) {
        quote = code;
      } else if (code === 0x3e /* > */) {
        break;
      }
      cursor++;
    }
    elements++;
    const selfClosing = xml.charCodeAt(cursor - 1) === 0x2f;
    if (!selfClosing) {
      depth++;
      if (depth > deepest) deepest = depth;
    } else if (depth + 1 > deepest) {
      deepest = depth + 1;
    }
    index = cursor + 1;
  }
  return { elements, depth: deepest };
}
