import { describe, expect, it } from "vitest";
import {
  failureMessage,
  IMPORT_FAILURE_KIND,
  type ImportFailureKind,
  PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE,
} from "./import-failure";

describe("failureMessage", () => {
  it("lists exactly the five Sentry failure categories from observability-and-delivery spec.md", () => {
    expect(IMPORT_FAILURE_KIND).toEqual([
      "download",
      "invalid_pdf",
      "no_text_layer",
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
      "invalid_pdf",
      "Este archivo no es un PDF válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.",
    ],
    [
      "no_text_layer",
      "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
    ],
    [
      "persistence",
      "La página cambió durante la importación, así que no reemplazamos su contenido. Vuelve a importar el PDF.",
    ],
    [
      "timeout",
      "La importación tardó demasiado. Inténtalo de nuevo con un PDF más pequeño o en unos minutos.",
    ],
  ];

  it.each(cases)("returns the design.md copy for %s", (kind, expected) => {
    expect(failureMessage(kind)).toBe(expected);
  });

  it("exposes the second persistence message (missing/archived page or DB error) separately", () => {
    expect(PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE).toBe(
      "La página de destino ya no está disponible. Vuelve a importar el PDF.",
    );
  });

  it("never contains stack traces, file paths, signed URLs or env var names (Errores seguros para la interfaz)", () => {
    const unsafePatterns = [/https?:\/\//, /\//, /\bat\s+\w+/, /process\.env/];
    for (const kind of IMPORT_FAILURE_KIND) {
      const message = failureMessage(kind);
      for (const pattern of unsafePatterns) {
        expect(message).not.toMatch(pattern);
      }
    }
  });
});
