// document-import T5: the formats Cogni imports and how to recognise them
// from the real bytes (never from the client-declared mime or the file
// name). Pure TypeScript: the ZIP container of DOCX/PPTX is read just far
// enough to list its entry names, with no npm dependency (`domain-no-npm`).
export const DOCUMENT_FORMATS = ["pdf", "docx", "pptx"] as const;
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];

// `legacy`: an OLE2 compound file — binary .doc/.ppt (and .xls), out of
// scope. `unknown`: anything else, including a ZIP that is not a Word or
// PowerPoint package (e.g. .xlsx).
export type DetectedFormat = DocumentFormat | "legacy" | "unknown";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04", a local file header
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_ZIP_COMMENT = 0xffff;

const CONTENT_TYPES_ENTRY = "[Content_Types].xml";
const WORD_MAIN_ENTRY = "word/document.xml";
const POWERPOINT_MAIN_ENTRY = "ppt/presentation.xml";

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return (
    bytes.length >= magic.length &&
    magic.every((byte, index) => bytes[index] === byte)
  );
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (u16(bytes, offset) | (u16(bytes, offset + 2) << 16)) >>> 0;
}

// Entry names are ASCII for the entries we look for; decoding byte by
// byte avoids TextDecoder edge cases with malformed input.
function asciiName(bytes: Uint8Array, start: number, length: number): string {
  let name = "";
  for (let index = start; index < start + length; index++) {
    name += String.fromCharCode(bytes[index]);
  }
  return name;
}

// Names listed by the central directory an end-of-central-directory
// candidate at `eocd` points to, or null when that candidate does not lead
// to a well-formed directory (a header missing or out of bounds) or
// declares no entries at all: an OOXML package always has entries, and a
// 0-entry record (e.g. one sitting in the archive comment) must not stop
// the search before the real one (T6 review follow-up).
function namesFromEocd(bytes: Uint8Array, eocd: number): string[] | null {
  const entries = u16(bytes, eocd + 10);
  if (entries === 0) return null;
  let offset = u32(bytes, eocd + 16);
  const names: string[] = [];
  for (let entry = 0; entry < entries; entry++) {
    if (offset + 46 > bytes.length) return null;
    if (u32(bytes, offset) !== CENTRAL_HEADER_SIGNATURE) return null;
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    if (offset + 46 + nameLength > bytes.length) return null;
    names.push(asciiName(bytes, offset + 46, nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

// Names from the central directory, located through the end-of-central-
// directory record (searched backwards past an optional comment). A
// candidate that does not lead to a valid directory — e.g. the signature
// bytes occurring inside the comment — is skipped and the search goes on
// (T5 review suggestion, fixed in T6). Returns null when no candidate is
// valid — a truncated or corrupt archive — so the caller can fall back.
function centralDirectoryNames(bytes: Uint8Array): string[] | null {
  const lowest = Math.max(
    0,
    bytes.length - END_OF_CENTRAL_DIRECTORY_SIZE - MAX_ZIP_COMMENT,
  );
  for (
    let eocd = bytes.length - END_OF_CENTRAL_DIRECTORY_SIZE;
    eocd >= lowest;
    eocd--
  ) {
    if (u32(bytes, eocd) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const names = namesFromEocd(bytes, eocd);
    if (names) return names;
  }
  return null;
}

// Fallback for an archive without a readable central directory (e.g. a
// truncated upload): every local file header still carries its entry
// name. A signature that happens to occur inside compressed data only
// yields a junk name, which never matches the entries we look for.
function localHeaderNames(bytes: Uint8Array): string[] {
  const names: string[] = [];
  for (let offset = 0; offset + 30 <= bytes.length; offset++) {
    if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4b) continue;
    if (u32(bytes, offset) !== LOCAL_HEADER_SIGNATURE) continue;
    const nameLength = u16(bytes, offset + 26);
    if (nameLength === 0 || offset + 30 + nameLength > bytes.length) continue;
    names.push(asciiName(bytes, offset + 30, nameLength));
  }
  return names;
}

// `requireContentTypes`: a complete archive (central directory read) must
// carry `[Content_Types].xml`, as every OOXML package does. A truncated one
// is judged by its main part alone, because writers may store
// `[Content_Types].xml` last (the T1 `docx` generator does): it is still
// recognised as the format it claims, so the extractor — not detection —
// fails it as `invalid_document`.
function officeFormat(
  names: readonly string[],
  requireContentTypes: boolean,
): DetectedFormat {
  const entries = new Set(names);
  if (requireContentTypes && !entries.has(CONTENT_TYPES_ENTRY)) {
    return "unknown";
  }
  if (entries.has(WORD_MAIN_ENTRY)) return "docx";
  if (entries.has(POWERPOINT_MAIN_ENTRY)) return "pptx";
  return "unknown";
}

export function detectDocumentFormat(bytes: Uint8Array): DetectedFormat {
  if (startsWith(bytes, PDF_MAGIC)) return "pdf";
  if (startsWith(bytes, OLE2_MAGIC)) return "legacy";
  if (!startsWith(bytes, ZIP_MAGIC)) return "unknown";
  const central = centralDirectoryNames(bytes);
  return central
    ? officeFormat(central, true)
    : officeFormat(localHeaderNames(bytes), false);
}
