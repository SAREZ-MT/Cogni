import { describe, expect, it } from "vitest";
import {
  failureMessage,
  IMPORT_FAILURE_KIND,
  type ImportFailureKind,
  PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE,
} from "./import-failure";

describe("failureMessage", () => {
  // T5 (document-import): `invalid_pdf` became `invalid_document`, and
  // `unsupported_format` (legacy/unknown bytes, or bytes that do not match
  // the declared format) and `empty_document` (a DOCX/PPTX with no text)
  // were added. `no_text_layer` keeps its PDF-only meaning.
  it("lists exactly the document import failure categories", () => {
    expect(IMPORT_FAILURE_KIND).toEqual([
      "download",
      "invalid_document",
      "unsupported_format",
      "no_text_layer",
      "empty_document",
      "persistence",
      "timeout",
    ]);
  });

  const cases: Array<[ImportFailureKind, string]> = [
    [
      "download",
      "No pudimos leer el archivo que subiste. Vuelve a importarlo.",
    ],
    [
      "invalid_document",
      "Este archivo no es un documento válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.",
    ],
    [
      "unsupported_format",
      "Solo puedes importar archivos PDF, Word (.docx) o PowerPoint (.pptx).",
    ],
    [
      "no_text_layer",
      "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
    ],
    ["empty_document", "El documento no tiene texto que podamos importar."],
    [
      "persistence",
      "La página cambió durante la importación, así que no reemplazamos su contenido. Vuelve a importar el documento.",
    ],
    [
      "timeout",
      "La importación tardó demasiado. Inténtalo de nuevo con un documento más pequeño o en unos minutos.",
    ],
  ];

  it.each(cases)("returns the design.md copy for %s", (kind, expected) => {
    expect(failureMessage(kind)).toBe(expected);
  });

  it("exposes the second persistence message (missing/archived page or DB error) separately", () => {
    expect(PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE).toBe(
      "La página de destino ya no está disponible. Vuelve a importar el documento.",
    );
  });

  it("never contains stack traces, file paths, signed URLs or env var names (Errores seguros para la interfaz) (R3-unsafe-copy-coverage-gap)", () => {
    const unsafePatterns = [/https?:\/\//, /\//, /\bat\s+\w+/, /process\.env/];
    const messages = [
      ...IMPORT_FAILURE_KIND.map((kind) => failureMessage(kind)),
      PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE,
    ];
    for (const message of messages) {
      for (const pattern of unsafePatterns) {
        expect(message).not.toMatch(pattern);
      }
    }
  });
});
