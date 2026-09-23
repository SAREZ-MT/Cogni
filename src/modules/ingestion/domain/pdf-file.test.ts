import { describe, expect, it } from "vitest";
import {
  isOwnedPdfPath,
  looksLikePdf,
  MAX_PDF_BYTES,
  PDF_MIME,
  pageTitleFromFileName,
  uploadIdAgeMs,
  validateFileName,
  validatePdfInput,
} from "./pdf-file";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f"; // valid UUID, version 4

// A syntactically valid UUID v7 (version nibble "7", RFC 4122 variant
// "8") whose first 12 hex digits encode `ms` as a big-endian 48-bit
// timestamp, matching how `@/shared/kernel/id.ts`'s `createId()` lays out
// bytes 0-5 (design.md: "uploadId = createId()").
function uuidV7WithTimestamp(ms: number): string {
  const hex = ms.toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7abc-89ab-000000000000`;
}

describe("validatePdfInput", () => {
  it("accepts application/pdf within the size bounds", () => {
    const result = validatePdfInput({ mime: PDF_MIME, sizeBytes: 1_048_576 });
    expect(result.ok).toBe(true);
  });

  it("accepts exactly MAX_PDF_BYTES", () => {
    const result = validatePdfInput({
      mime: PDF_MIME,
      sizeBytes: MAX_PDF_BYTES,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a non-PDF mime type", () => {
    const result = validatePdfInput({
      mime: "image/png",
      sizeBytes: 1_048_576,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PDF_MIME_NOT_ALLOWED");
  });

  it("rejects sizeBytes of 0", () => {
    const result = validatePdfInput({ mime: PDF_MIME, sizeBytes: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PDF_TOO_LARGE");
  });

  it("rejects sizeBytes one over MAX_PDF_BYTES (20 971 521)", () => {
    const result = validatePdfInput({
      mime: PDF_MIME,
      sizeBytes: MAX_PDF_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PDF_TOO_LARGE");
  });

  it("rejects a negative sizeBytes", () => {
    const result = validatePdfInput({ mime: PDF_MIME, sizeBytes: -1 });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer sizeBytes", () => {
    const result = validatePdfInput({ mime: PDF_MIME, sizeBytes: 100.5 });
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
    expect(result.error.code).toBe("PDF_FILE_NAME_INVALID");
  });

  it("rejects an empty name after trim", () => {
    const result = validateFileName("   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PDF_FILE_NAME_INVALID");
  });
});

describe("isOwnedPdfPath", () => {
  it("accepts the exact {ownerId}/{uuid v7}.pdf shape", () => {
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(Date.now())}.pdf`;
    expect(isOwnedPdfPath(OWNER_ID, path)).toBe(true);
  });

  it("rejects a path owned by someone else", () => {
    const otherOwner = "00000000-0000-4000-8000-000000000000";
    const path = `${otherOwner}/${uuidV7WithTimestamp(Date.now())}.pdf`;
    expect(isOwnedPdfPath(OWNER_ID, path)).toBe(false);
  });

  it("rejects a path containing ..", () => {
    const path = `${OWNER_ID}/../${uuidV7WithTimestamp(Date.now())}.pdf`;
    expect(isOwnedPdfPath(OWNER_ID, path)).toBe(false);
  });

  it("rejects a UUID that is not version 7", () => {
    // version nibble "4", not "7"
    const path = `${OWNER_ID}/3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f.pdf`;
    expect(isOwnedPdfPath(OWNER_ID, path)).toBe(false);
  });

  it("rejects a path missing the .pdf extension", () => {
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(Date.now())}`;
    expect(isOwnedPdfPath(OWNER_ID, path)).toBe(false);
  });
});

describe("uploadIdAgeMs", () => {
  it("computes the age from the UUID v7 embedded timestamp", () => {
    const issuedAt = new Date("2026-09-23T10:00:00.000Z").getTime();
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(issuedAt)}.pdf`;
    const now = new Date(issuedAt + 90_000);

    expect(uploadIdAgeMs(path, now)).toBe(90_000);
  });

  it("returns a negative age when now is before the embedded timestamp", () => {
    const issuedAt = new Date("2026-09-23T10:00:00.000Z").getTime();
    const path = `${OWNER_ID}/${uuidV7WithTimestamp(issuedAt)}.pdf`;
    const now = new Date(issuedAt - 1_000);

    expect(uploadIdAgeMs(path, now)).toBe(-1_000);
  });
});

describe("looksLikePdf", () => {
  it("accepts bytes starting with %PDF-", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n");
    expect(looksLikePdf(bytes)).toBe(true);
  });

  it("rejects bytes not starting with %PDF-", () => {
    const bytes = new TextEncoder().encode("not a pdf at all");
    expect(looksLikePdf(bytes)).toBe(false);
  });

  it("rejects a byte array shorter than the magic number", () => {
    const bytes = new TextEncoder().encode("%PD");
    expect(looksLikePdf(bytes)).toBe(false);
  });
});

describe("pageTitleFromFileName", () => {
  it("strips the .pdf extension case-insensitively", () => {
    expect(pageTitleFromFileName("Cálculo I - unidad 3.PDF")).toBe(
      "Cálculo I - unidad 3",
    );
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
});
