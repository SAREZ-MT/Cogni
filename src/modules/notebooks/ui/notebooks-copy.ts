import { ASSET_ERROR, NOTEBOOK_ERROR, PAGE_ERROR } from "../domain/errors";

// Every user-facing notebooks message lives here: Spanish, "tú",
// actionable (same pattern as identity/ui/auth-copy.ts).
export const NOTEBOOKS_COPY = {
  sessionRequired: "Debes iniciar sesión para continuar.",
  invalidInput: "Revisa los datos: algo no tiene el formato esperado.",
  notebookNotFound: "No encontramos ese cuaderno.",
  notebookArchived: "Ese cuaderno está archivado.",
  invalidTitle: "El título no puede estar vacío ni superar los 120 caracteres.",
  invalidColor: "Ese color no está disponible.",
  pageNotFound: "No encontramos esa página.",
  pageVersionConflict:
    "La página cambió en otra pestaña. Actualiza el contenido antes de guardar de nuevo.",
  invalidContent: "El contenido de la página no tiene un formato válido.",
  assetMimeNotAllowed: "Ese tipo de archivo no está permitido.",
  assetTooLarge: "El archivo supera el tamaño máximo permitido.",
  assetPathOutOfScope: "No puedes subir un archivo a esa ubicación.",
  assetForbidden: "No tienes acceso a ese archivo.",
  unexpected: "No pudimos completar la acción. Inténtalo de nuevo.",
} as const;

export function messageForNotebooksErrorCode(code: string): string {
  switch (code) {
    case "NOTEBOOKS_INVALID_INPUT":
      return NOTEBOOKS_COPY.invalidInput;
    case NOTEBOOK_ERROR.NOT_FOUND:
      return NOTEBOOKS_COPY.notebookNotFound;
    case NOTEBOOK_ERROR.ARCHIVED:
      return NOTEBOOKS_COPY.notebookArchived;
    case NOTEBOOK_ERROR.INVALID_TITLE:
      return NOTEBOOKS_COPY.invalidTitle;
    case NOTEBOOK_ERROR.INVALID_COLOR:
      return NOTEBOOKS_COPY.invalidColor;
    case PAGE_ERROR.NOT_FOUND:
      return NOTEBOOKS_COPY.pageNotFound;
    case PAGE_ERROR.VERSION_CONFLICT:
      return NOTEBOOKS_COPY.pageVersionConflict;
    case PAGE_ERROR.INVALID_CONTENT:
      return NOTEBOOKS_COPY.invalidContent;
    case ASSET_ERROR.MIME_NOT_ALLOWED:
      return NOTEBOOKS_COPY.assetMimeNotAllowed;
    case ASSET_ERROR.TOO_LARGE:
      return NOTEBOOKS_COPY.assetTooLarge;
    case ASSET_ERROR.PATH_OUT_OF_SCOPE:
      return NOTEBOOKS_COPY.assetPathOutOfScope;
    case ASSET_ERROR.FORBIDDEN:
      return NOTEBOOKS_COPY.assetForbidden;
    default:
      return NOTEBOOKS_COPY.unexpected;
  }
}
