// Failure taxonomy for a `failed` ImportJob (design.md, "Decision: Entidad
// ImportJob y transiciones de la spec"). These five values are also the
// Sentry failure categories from specs/observability-and-delivery/spec.md
// ("descarga, PDF inválido, sin capa de texto, persistencia, tiempo
// agotado"): the same taxonomy both closes the job and classifies the
// server-side report, so there is exactly one place that names it.
export const IMPORT_FAILURE_KIND = [
  "download",
  "invalid_pdf",
  "no_text_layer",
  "persistence",
  "timeout",
] as const;

export type ImportFailureKind = (typeof IMPORT_FAILURE_KIND)[number];

// UI-safe Spanish copy per failure kind (design.md's message table). Lives
// in `domain` because `processImportJob` (application) and the abandoned-job
// rule of `getImportJobStatus` (application) both need the exact same
// `timeout` text, and no message here may ever contain a stack trace, a file
// path, a signed URL or an environment variable name (requirement "Errores
// seguros para la interfaz").
const FAILURE_MESSAGE: Record<ImportFailureKind, string> = {
  download: "No pudimos leer el archivo que subiste. Vuelve a importarlo.",
  invalid_pdf:
    "Este archivo no es un PDF válido o está protegido. Revisa que no tenga contraseña e inténtalo de nuevo.",
  no_text_layer:
    "Este PDF no tiene texto seleccionable y Cogni no hace OCR. Prueba con un PDF que tenga texto.",
  persistence:
    "La página cambió durante la importación, así que no reemplazamos su contenido. Vuelve a importar el PDF.",
  timeout:
    "La importación tardó demasiado. Inténtalo de nuevo con un PDF más pequeño o en unos minutos.",
};

// design.md documents two distinct causes under the single `persistence`
// kind: a version conflict (`FAILURE_MESSAGE.persistence`, the more common
// one and this kind's canonical `failureMessage` text) and a missing or
// archived destination page, or a database error (`PAGE_NOT_FOUND`/DB
// failure). `fail()`'s `message` field is supplied by the caller, not
// derived from `kind` alone, so `processImportJob` (T6) picks this text
// explicitly when the cause is the missing-page case instead of the
// version-conflict default `failureMessage("persistence")` returns.
export const PERSISTENCE_PAGE_UNAVAILABLE_MESSAGE =
  "La página de destino ya no está disponible. Vuelve a importar el PDF.";

export function failureMessage(reason: ImportFailureKind): string {
  return FAILURE_MESSAGE[reason];
}
