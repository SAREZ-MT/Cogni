// design.md, "Decision: Flujo de subida y procesamiento" and the
// `pdf-file.ts` signatures block. Pure validators/helpers around a PDF
// upload: file constraints (mime/size/name), the server-assigned storage
// path shape, its embedded upload instant, the real-bytes magic-number
// check, and the page title derived from the original file name.
import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PDF_FILE_ERROR } from "./errors";

export const PDF_MIME = "application/pdf";
export const MAX_PDF_BYTES = 20_971_520; // 20 MiB, product decision 1
export const UPLOAD_GRANT_TTL_MS = 10 * 60 * 1000; // C3: 10-minute upload grant

// "%PDF-" as bytes.
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

// {ownerId}/{uuid v7}.pdf, exactly — the server-assigned canonical path
// (design.md, "Ruta canónica asignada por el servidor"). A single "/" is
// required so no path traversal or extra segment can slip through, and
// the second segment must be a syntactically valid UUID v7 (version
// nibble "7", RFC 4122 variant "8"/"9"/"a"/"b"), not any UUID version.
const OWNED_PDF_PATH =
  /^([^/]+)\/([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.pdf$/i;

const PDF_EXTENSION = /\.pdf$/i;

export function validatePdfInput(input: {
  mime: string;
  sizeBytes: number;
}): Result<void, DomainError> {
  if (input.mime !== PDF_MIME) {
    return err(
      new DomainError(
        PDF_FILE_ERROR.MIME_NOT_ALLOWED,
        `unsupported mime type: ${input.mime}`,
      ),
    );
  }
  if (
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_PDF_BYTES
  ) {
    return err(
      new DomainError(
        PDF_FILE_ERROR.TOO_LARGE,
        `sizeBytes out of range (0, ${MAX_PDF_BYTES}]: ${input.sizeBytes}`,
      ),
    );
  }
  return ok(undefined);
}

export function validateFileName(
  fileName: string,
): Result<string, DomainError> {
  const trimmed = fileName.trim();
  if (trimmed.length === 0 || trimmed.length > 255) {
    return err(
      new DomainError(
        PDF_FILE_ERROR.FILE_NAME_INVALID,
        "fileName must be 1..255 characters after trim",
      ),
    );
  }
  return ok(trimmed);
}

export function isOwnedPdfPath(ownerId: string, path: string): boolean {
  const match = OWNED_PDF_PATH.exec(path);
  return match !== null && match[1] === ownerId;
}

// The UUID v7's leading 12 hex digits (48 bits) encode the unix
// millisecond timestamp it was created at, big-endian — the same layout
// `@/shared/kernel/id.ts`'s `createId()` writes. `age = now - timestamp`.
export function uploadIdAgeMs(path: string, now: Date): number {
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  const uploadId = fileName.replace(PDF_EXTENSION, "");
  const timestampHex = uploadId.replace(/-/g, "").slice(0, 12);
  const timestampMs = Number.parseInt(timestampHex, 16);
  return now.getTime() - timestampMs;
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

export function pageTitleFromFileName(fileName: string): string | undefined {
  // `split` always returns at least one element, so the last one is
  // always defined; no fallback needed (and none that vitest could ever
  // exercise, since `split` on a string can never return an empty array).
  const segments = fileName.split(/[/\\]/);
  const base = segments[segments.length - 1];
  const withoutExtension = base.replace(PDF_EXTENSION, "");
  const collapsed = withoutExtension.replace(/\s+/g, " ").trim();
  const truncated = collapsed.slice(0, 120);
  return truncated.length > 0 ? truncated : undefined;
}
