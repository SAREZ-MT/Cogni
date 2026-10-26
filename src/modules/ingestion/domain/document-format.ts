// document-import T5: the formats Cogni imports and how to recognise them
// from the real bytes (never from the client-declared mime or the file
// name). Pure TypeScript: the ZIP container of DOCX/PPTX is read just far
// enough to list its entry names, with no npm dependency (`domain-no-npm`).
import { asciiName, readZipDirectory, u16, u32 } from "./zip-directory";

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

const CONTENT_TYPES_ENTRY = "[Content_Types].xml";
const WORD_MAIN_ENTRY = "word/document.xml";
const POWERPOINT_MAIN_ENTRY = "ppt/presentation.xml";

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  return (
    bytes.length >= magic.length &&
    magic.every((byte, index) => bytes[index] === byte)
  );
}

// Names from the central directory (zip-directory.ts; T9b moved the
// parser there so the OOXML guard reads the same records). null when no
// end-of-central-directory candidate is valid — a truncated or corrupt
// archive — so the caller can fall back.
function centralDirectoryNames(bytes: Uint8Array): string[] | null {
  return readZipDirectory(bytes)?.map((entry) => entry.name) ?? null;
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
