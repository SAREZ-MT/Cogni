import { describe, expect, it } from "vitest";
import {
  DOCX_MIME,
  documentFormatFromMime,
  documentFormatFromPath,
  documentStoragePath,
  isOwnedDocumentPath,
  MAX_DOCUMENT_BYTES,
  PDF_MIME,
  PPTX_MIME,
  pageTitleFromFileName,
  uploadIdAgeMs,
  validateDocumentInput,
  validateFileName,
} from "./document-file";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f"; // valid UUID, version 4

// A syntactically valid UUID v7 (version nibble "7", RFC 4122 variant
// "8") whose first 12 hex digits encode `ms` as a big-endian 48-bit
// timestamp, matching how `@/shared/kernel/id.ts`'s `createId()` lays out
// bytes 0-5 (design.md: "uploadId = createId()").
function uuidV7WithTimestamp(ms: number): string {
  const hex = ms.toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7abc-89ab-000000000000`;
}

describe("validateDocumentInput", () => {
  it("accepts application/pdf within the size bounds", () => {
    const result = validateDocumentInput({
      mime: PDF_MIME,
      sizeBytes: 1_048_576,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts exactly MAX_DOCUMENT_BYTES", () => {
    const result = validateDocumentInput({
      mime: PDF_MIME,
      sizeBytes: MAX_DOCUMENT_BYTES,
    });
    expect(result.ok).toBe(true);
  });

  it.each([
    [PDF_MIME, "pdf"],
    [DOCX_MIME, "docx"],
    [PPTX_MIME, "pptx"],
  ])("accepts %s and returns its format (%s)", (mime, format) => {
    const result = validateDocumentInput({ mime, sizeBytes: 1_048_576 });
    expect(result).toEqual({ ok: true, value: format });
  });

  it("keeps the 20 MiB limit for every format", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(20_971_520);
    const result = validateDocumentInput({
      mime: DOCX_MIME,
      sizeBytes: MAX_DOCUMENT_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_TOO_LARGE");
  });

  it("rejects the legacy binary Office mimes", () => {
    for (const mime of [
      "application/msword",
      "application/vnd.ms-powerpoint",
    ]) {
      const result = validateDocumentInput({ mime, sizeBytes: 1_048_576 });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("DOCUMENT_MIME_NOT_ALLOWED");
    }
  });

  it("rejects a non-document mime type", () => {
    const result = validateDocumentInput({
      mime: "image/png",
      sizeBytes: 1_048_576,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_MIME_NOT_ALLOWED");
  });

  it("rejects sizeBytes of 0", () => {
    const result = validateDocumentInput({ mime: PDF_MIME, sizeBytes: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_TOO_LARGE");
  });

  it("rejects sizeBytes one over MAX_DOCUMENT_BYTES (20 971 521)", () => {
    const result = validateDocumentInput({
      mime: PDF_MIME,
      sizeBytes: MAX_DOCUMENT_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_TOO_LARGE");
  });

  it("rejects a negative sizeBytes", () => {
    const result = validateDocumentInput({ mime: PDF_MIME, sizeBytes: -1 });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer sizeBytes", () => {
    const result = validateDocumentInput({ mime: PDF_MIME, sizeBytes: 100.5 });
    expect(result.ok).toBe(false);
  });
});

describe("validateFileName", () => {
  it("returns the trimmed name when 1..255 characters", () => {
    const result = validateFileName("  Cálculo I - unidad 3.pdf  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("Cálculo I - unidad 3.pdf");
  });

  it("accepts a name of exactly 255 characters", () => {
    const result = validateFileName("a".repeat(255));
    expect(result.ok).toBe(true);
  });

  it("rejects a name of 256 characters", () => {
    const result = validateFileName("a".repeat(256));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_FILE_NAME_INVALID");
  });

  it("rejects an empty name after trim", () => {
    const result = validateFileName("   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DOCUMENT_FILE_NAME_INVALID");
  });
});

describe("isOwnedDocumentPath", () => {
  it.each([
    "pdf",
    "docx",
    "pptx",
  ])("accepts the exact {ownerId}/{uuid v7}.%s shape", (extension) => {
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(Date.now())}.${extension}`;
    expect(isOwnedDocumentPath(OWNER_ID, path)).toBe(true);
  });

  it("rejects an extension outside the three formats (e.g. .doc)", () => {
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(Date.now())}.doc`;
    expect(isOwnedDocumentPath(OWNER_ID, path)).toBe(false);
  });

  it("rejects a path owned by someone else", () => {
    const otherOwner = "00000000-0000-4000-8000-000000000000";
    const path = `${otherOwner}/${uuidV7WithTimestamp(Date.now())}.pdf`;
    expect(isOwnedDocumentPath(OWNER_ID, path)).toBe(false);
  });

  it("rejects a path containing ..", () => {
    const path = `${OWNER_ID}/../${uuidV7WithTimestamp(Date.now())}.pdf`;
    expect(isOwnedDocumentPath(OWNER_ID, path)).toBe(false);
  });

  it("rejects a UUID that is not version 7", () => {
    // version nibble "4", not "7"
    const path = `${OWNER_ID}/3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f.pdf`;
    expect(isOwnedDocumentPath(OWNER_ID, path)).toBe(false);
  });

  it("rejects a path missing the extension", () => {
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(Date.now())}`;
    expect(isOwnedDocumentPath(OWNER_ID, path)).toBe(false);
  });
});

describe("documentStoragePath / documentFormatFromPath / documentFormatFromMime", () => {
  it("builds {ownerId}/{uploadId}.{extension} and reads the format back", () => {
    const uploadId = uuidV7WithTimestamp(Date.now());
    for (const format of ["pdf", "docx", "pptx"] as const) {
      const path = documentStoragePath(OWNER_ID, uploadId, format);
      expect(path).toBe(`${OWNER_ID}/${uploadId}.${format}`);
      expect(isOwnedDocumentPath(OWNER_ID, path)).toBe(true);
      expect(documentFormatFromPath(path)).toBe(format);
    }
  });

  it("reads the extension case-insensitively and returns null for anything else", () => {
    expect(documentFormatFromPath("a/b.PPTX")).toBe("pptx");
    expect(documentFormatFromPath("a/b.doc")).toBeNull();
    expect(documentFormatFromPath("a/b")).toBeNull();
  });

  it("maps each allowed mime to its format and anything else to null", () => {
    expect(documentFormatFromMime(PDF_MIME)).toBe("pdf");
    expect(documentFormatFromMime(DOCX_MIME)).toBe("docx");
    expect(documentFormatFromMime(PPTX_MIME)).toBe("pptx");
    expect(documentFormatFromMime("application/msword")).toBeNull();
  });
});

describe("uploadIdAgeMs", () => {
  it("computes the age from the UUID v7 embedded timestamp", () => {
    const issuedAt = new Date("2026-09-23T10:00:00.000Z").getTime();
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(issuedAt)}.pdf`;
    const now = new Date(issuedAt + 90_000);

    expect(uploadIdAgeMs(path, now)).toBe(90_000);
  });

  it("reads the same timestamp from a .docx or .pptx path", () => {
    const issuedAt = new Date("2026-09-23T10:00:00.000Z").getTime();
    const uploadId = uuidV7WithTimestamp(issuedAt);
    const now = new Date(issuedAt + 5_000);

    expect(uploadIdAgeMs(`${OWNER_ID}/${uploadId}.docx`, now)).toBe(5_000);
    expect(uploadIdAgeMs(`${OWNER_ID}/${uploadId}.pptx`, now)).toBe(5_000);
  });

  it("returns a negative age when now is before the embedded timestamp", () => {
    const issuedAt = new Date("2026-09-23T10:00:00.000Z").getTime();
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(issuedAt)}.pdf`;
    const now = new Date(issuedAt - 1_000);

    expect(uploadIdAgeMs(path, now)).toBe(-1_000);
  });

  // T3 follow-up (R3-upload-age-nan-fail-open): a malformed last segment
  // must fail closed (treated as infinitely old), never fail open.
  it("returns +Infinity when the last segment has non-hex characters (fails closed, not open)", () => {
    const path = `${OWNER_ID}/not-a-real-uuid-segment.pdf`;
    const now = new Date("2026-09-23T10:00:00.000Z");

    expect(uploadIdAgeMs(path, now)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns +Infinity when the last segment has fewer than 12 hex digits", () => {
    const path = `${OWNER_ID}/abc123.pdf`;
    const now = new Date("2026-09-23T10:00:00.000Z");

    expect(uploadIdAgeMs(path, now)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("pageTitleFromFileName", () => {
  it("strips the .pdf extension case-insensitively", () => {
    expect(pageTitleFromFileName("Cálculo I - unidad 3.PDF")).toBe(
      "Cálculo I - unidad 3",
    );
  });

  it("strips the .docx and .pptx extensions too", () => {
    expect(pageTitleFromFileName("Apuntes.docx")).toBe("Apuntes");
    expect(pageTitleFromFileName("Clase 4.PPTX")).toBe("Clase 4");
    expect(pageTitleFromFileName("informe.doc")).toBe("informe.doc");
  });

  it("strips directory components", () => {
    expect(pageTitleFromFileName("carpeta/subcarpeta/Notas.pdf")).toBe("Notas");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(pageTitleFromFileName("  Notas   de   clase  .pdf")).toBe(
      "Notas de clase",
    );
  });

  it("truncates to 120 characters", () => {
    const longName = `${"a".repeat(130)}.pdf`;
    const title = pageTitleFromFileName(longName);
    expect(title).toBe("a".repeat(120));
  });

  it("returns undefined when nothing is left after stripping", () => {
    expect(pageTitleFromFileName(".pdf")).toBeUndefined();
    expect(pageTitleFromFileName("   .pdf")).toBeUndefined();
  });

  // T3 follow-up (R3-title-truncation-trailing-space): truncating at a
  // fixed length can land right after a space; that trailing space must
  // be trimmed away too, not just the one from the original edges.
  it("trims a trailing space left by truncation at the 120-character cut", () => {
    const name = `${"a".repeat(119)} ${"b".repeat(50)}.pdf`;
    const title = pageTitleFromFileName(name);

    expect(title).toBe("a".repeat(119));
    expect(title?.endsWith(" ")).toBe(false);
  });

  // T3 follow-up (R3-title-truncation-trailing-space): a naive slice(0, 120)
  // can land in the middle of a surrogate pair (e.g. an emoji), producing
  // an invalid lone surrogate; the whole character must be dropped
  // instead.
  it("never splits a surrogate pair (emoji) at the 120-character cut", () => {
    const name = `${"a".repeat(119)}😀${"resto de un texto largo"}.pdf`;
    const title = pageTitleFromFileName(name);

    expect(title).toBe("a".repeat(119));
    // No lone surrogate (a half-emoji) survives in the result.
    expect(title).not.toMatch(/[\uD800-\uDFFF]/);
  });
});
