import {
  IMPORT_JOB_ERROR,
  INGESTION_ERROR,
  PDF_FILE_ERROR,
} from "../domain/errors";

// Every user-facing ingestion message lives here: Spanish, "tú", sentence
// case, no emoji — same pattern as notebooks/ui/notebooks-copy.ts. The
// `progress` texts below are quoted verbatim from design.md's six-state
// table ("Decision: Indicador de progreso y copy"): they start with a
// lowercase letter on purpose ("oración con minúscula inicial").
export const INGESTION_COPY = {
  importPdf: "Importar PDF",
  invalidFileType: "solo puedes importar archivos PDF",
  fileTooLarge: "el PDF supera el límite de 20 MB",
  sessionRequired: "Debes iniciar sesión para continuar.",
  invalidInput: "Revisa los datos: algo no tiene el formato esperado.",
  notebookNotFound: "No encontramos ese cuaderno.",
  notebookMismatch: "Este PDF ya se está importando en otro cuaderno.",
  pageNotFound: "No encontramos la página de esa importación.",
  storageUnavailable:
    "No pudimos conectar con el almacenamiento. Inténtalo de nuevo.",
  invalidFileName: "El nombre del archivo no es válido.",
  uploadExpired: "El enlace de subida expiró. Vuelve a intentarlo.",
  uploadFailed:
    "No pudimos confirmar la subida del archivo. Vuelve a intentarlo.",
  unreadablePdf: "No pudimos leer ese PDF.",
  importNotFound: "No encontramos esa importación.",
  unexpected: "No pudimos completar la importación. Inténtalo de nuevo.",
  progress: {
    uploading: "subiendo el archivo…",
    queued: "preparando la importación…",
    processing: "procesando el PDF…",
    done: "listo",
    delay:
      "la importación está tardando más de lo esperado; esta página se actualizará sola",
    genericError: "no pudimos completar la importación",
  },
} as const;

// design.md, six-state table: singular for exactly one omitted page,
// plural with the real count otherwise.
export function pagesOmittedMessage(count: number): string {
  return count === 1
    ? "1 página no tenía texto y se omitió"
    : `${count} páginas no tenían texto y se omitieron`;
}

// Maps a Server Action's ActionError.code (always in English/technical,
// see toActionError()) to its centralized Spanish copy — same pattern as
// notebooks/ui/notebooks-copy.ts's messageForNotebooksErrorCode.
export function messageForIngestionErrorCode(code: string): string {
  switch (code) {
    case INGESTION_ERROR.SESSION_REQUIRED:
      return INGESTION_COPY.sessionRequired;
    case INGESTION_ERROR.NOTEBOOK_NOT_FOUND:
      return INGESTION_COPY.notebookNotFound;
    case INGESTION_ERROR.NOTEBOOK_MISMATCH:
      return INGESTION_COPY.notebookMismatch;
    case INGESTION_ERROR.PAGE_NOT_FOUND:
      return INGESTION_COPY.pageNotFound;
    case INGESTION_ERROR.STORAGE_UNAVAILABLE:
      return INGESTION_COPY.storageUnavailable;
    case INGESTION_ERROR.UNEXPECTED:
      return INGESTION_COPY.unexpected;
    case PDF_FILE_ERROR.MIME_NOT_ALLOWED:
      return INGESTION_COPY.invalidFileType;
    case PDF_FILE_ERROR.TOO_LARGE:
      return INGESTION_COPY.fileTooLarge;
    case PDF_FILE_ERROR.FILE_NAME_INVALID:
      return INGESTION_COPY.invalidFileName;
    case PDF_FILE_ERROR.PATH_OUT_OF_SCOPE:
      return INGESTION_COPY.uploadExpired;
    case PDF_FILE_ERROR.UPLOAD_EXPIRED:
      return INGESTION_COPY.uploadExpired;
    case PDF_FILE_ERROR.OBJECT_MISSING:
      return INGESTION_COPY.uploadFailed;
    case PDF_FILE_ERROR.UNREADABLE:
      return INGESTION_COPY.unreadablePdf;
    case IMPORT_JOB_ERROR.NOT_FOUND:
      return INGESTION_COPY.importNotFound;
    case IMPORT_JOB_ERROR.INVALID_TRANSITION:
      return INGESTION_COPY.unexpected;
    case IMPORT_JOB_ERROR.STORAGE_PATH_CONFLICT:
      return INGESTION_COPY.unexpected;
    case "INGESTION_INVALID_INPUT":
      return INGESTION_COPY.invalidInput;
    default:
      return INGESTION_COPY.unexpected;
  }
}
