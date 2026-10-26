// design.md, "Decision: Flujo de subida y procesamiento" and the
// `pdf-file.ts` signatures block, generalized from PDF to PDF/DOCX/PPTX in
// document-import T5. Pure validators/helpers around a document upload:
// file constraints (mime/size/name), the server-assigned storage path
// shape (its extension records the declared format), its embedded upload
// instant, and the page title derived from the original file name. The
// real bytes are checked by `detectDocumentFormat` (document-format.ts).
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { DocumentFormat } from "./document-format";
import { DOCUMENT_FILE_ERROR } from "./errors";

export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const DOCUMENT_MIME: Readonly<Record<DocumentFormat, string>> = {
  pdf: PDF_MIME,
  docx: DOCX_MIME,
  pptx: PPTX_MIME,
};

// 20 MiB for every format (product decision 1, kept for DOCX/PPTX: the T0
// spike parsed the 30-page DOCX and 40-slide PPTX well under that size and
// within the processing budget).
export const MAX_DOCUMENT_BYTES = 20_971_520;
export const UPLOAD_GRANT_TTL_MS = 10 * 60 * 1000; // C3: 10-minute upload grant

// {ownerId}/{uuid v7}.{pdf|docx|pptx}, exactly — the server-assigned
// canonical path (design.md, "Ruta canónica asignada por el servidor"). A
// single "/" is required so no path traversal or extra segment can slip
// through, and the second segment must be a syntactically valid UUID v7
// (version nibble "7", RFC 4122 variant "8"/"9"/"a"/"b"), not any UUID
// version.
const OWNED_DOCUMENT_PATH =
  /^([^/]+)\/([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(pdf|docx|pptx)$/i;

const DOCUMENT_EXTENSION = /\.(pdf|docx|pptx)$/i;

export function documentFormatFromMime(mime: string): DocumentFormat | null {
  for (const [format, allowed] of Object.entries(DOCUMENT_MIME)) {
    if (allowed === mime) return format as DocumentFormat;
  }
  return null;
}

// The format a storage path declares through its extension (the server
// picks it from the validated mime in `requestPdfUpload`).
export function documentFormatFromPath(path: string): DocumentFormat | null {
  const match = DOCUMENT_EXTENSION.exec(path);
  return match ? (match[1].toLowerCase() as DocumentFormat) : null;
}

export function documentStoragePath(
  ownerId: string,
  uploadId: string,
  format: DocumentFormat,
): string {
  return `${ownerId}/${uploadId}.${format}`;
}

export function validateDocumentInput(input: {
  mime: string;
  sizeBytes: number;
}): Result<DocumentFormat, DomainError> {
  const format = documentFormatFromMime(input.mime);
  if (!format) {
    return err(
      new DomainError(
        DOCUMENT_FILE_ERROR.MIME_NOT_ALLOWED,
        `unsupported mime type: ${input.mime}`,
      ),
    );
  }
  if (
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_DOCUMENT_BYTES
  ) {
    return err(
      new DomainError(
        DOCUMENT_FILE_ERROR.TOO_LARGE,
        `sizeBytes out of range (0, ${MAX_DOCUMENT_BYTES}]: ${input.sizeBytes}`,
      ),
    );
  }
  return ok(format);
}

export function validateFileName(
  fileName: string,
): Result<string, DomainError> {
  const trimmed = fileName.trim();
  if (trimmed.length === 0 || trimmed.length > 255) {
    return err(
      new DomainError(
        DOCUMENT_FILE_ERROR.FILE_NAME_INVALID,
        "fileName must be 1..255 characters after trim",
      ),
    );
  }
  return ok(trimmed);
}

export function isOwnedDocumentPath(ownerId: string, path: string): boolean {
  const match = OWNED_DOCUMENT_PATH.exec(path);
  return match !== null && match[1] === ownerId;
}

// The UUID v7's leading 12 hex digits (48 bits) encode the unix
// millisecond timestamp it was created at, big-endian — the same layout
// `@/shared/kernel/id.ts`'s `createId()` writes. `age = now - timestamp`.
//
// A malformed last segment (fewer than 12 hex digits, or characters
// outside 0-9a-f) has no valid embedded timestamp. `Number.parseInt`
// would silently return `NaN`, which fails OPEN: `NaN > tenMinutes` is
// always `false`, so a caller doing a plain "> TTL" check would treat a
// garbled path as fresh. Returning `+Infinity` instead makes every "is
// this too old" comparison resolve to expired (review follow-up from T3:
// R3-upload-age-nan-fail-open; `startPdfImport` relies on this sentinel
// instead of its own `Number.isFinite` guard).
export function uploadIdAgeMs(path: string, now: Date): number {
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  const uploadId = fileName.replace(DOCUMENT_EXTENSION, "");
  const timestampHex = uploadId.replace(/-/g, "").slice(0, 12);
  if (!/^[0-9a-f]{12}$/i.test(timestampHex)) {
    return Number.POSITIVE_INFINITY;
  }
  const timestampMs = Number.parseInt(timestampHex, 16);
  return now.getTime() - timestampMs;
}

const TITLE_MAX_LENGTH = 120;

// UTF-16 high surrogates (0xD800-0xDBFF): `slice` cuts by code unit, not
// by code point, so slicing right after a high surrogate would keep a
// lone surrogate in the result — an invalid, unrenderable half of an
// astral character (e.g. an emoji). Pulling the cut back one unit drops
// the whole character instead of mangling it (T3 follow-up:
// R3-title-truncation-trailing-space).
function truncateWithoutSplittingSurrogates(
  text: string,
  maxLength: number,
): string {
  if (text.length <= maxLength) return text;
  const isHighSurrogate =
    maxLength > 0 &&
    text.charCodeAt(maxLength - 1) >= 0xd800 &&
    text.charCodeAt(maxLength - 1) <= 0xdbff;
  return text.slice(0, isHighSurrogate ? maxLength - 1 : maxLength);
}

export function pageTitleFromFileName(fileName: string): string | undefined {
  // `split` always returns at least one element, so the last one is
  // always defined; no fallback needed (and none that vitest could ever
  // exercise, since `split` on a string can never return an empty array).
  const segments = fileName.split(/[/\\]/);
  // document-import T9b (security audit): control (Cc) and format (Cf)
  // characters — bidi overrides/isolates U+202A–U+202E and U+2066–U+2069,
  // zero-width ones, the BOM, soft hyphens — are dropped before anything
  // else, so a name cannot spoof another one ("factura\u202Efdp.docx"
  // renders as "facturaxcod.pdf") or hide text; whitespace controls (tab,
  // newline, NEL) become a space instead of gluing words together.
  const base = segments[segments.length - 1].replace(
    /[\p{Cc}\p{Cf}]/gu,
    (char) => (/\s/u.test(char) ? " " : ""),
  );
  const withoutExtension = base.trimEnd().replace(DOCUMENT_EXTENSION, "");
  const collapsed = withoutExtension.replace(/\s+/g, " ").trim();
  // Truncating at a fixed length can land right after a space (leaving a
  // trailing space) as easily as mid-word; trim again after cutting
  // (T3 follow-up: R3-title-truncation-trailing-space).
  const truncated = truncateWithoutSplittingSurrogates(
    collapsed,
    TITLE_MAX_LENGTH,
  ).trim();
  return truncated.length > 0 ? truncated : undefined;
}
