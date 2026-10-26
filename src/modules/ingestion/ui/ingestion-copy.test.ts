import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FILE_ERROR,
  IMPORT_JOB_ERROR,
  INGESTION_ERROR,
} from "../domain/errors";
import {
  INGESTION_COPY,
  messageForIngestionErrorCode,
  pagesOmittedMessage,
} from "./ingestion-copy";

describe("INGESTION_COPY", () => {
  it("never contains emoji", () => {
    const flat = JSON.stringify(INGESTION_COPY);
    // Astral-plane emoji live outside the BMP; every string in the copy
    // table must stay within it (design-system README, "Emoji: NOT used").
    // eslint-disable-next-line no-control-regex
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(flat)).toBe(false);
  });

  it("uses sentence case with a lowercase first letter for every progress state text", () => {
    for (const text of Object.values(INGESTION_COPY.progress)) {
      expect(text[0]).toBe(text[0]?.toLowerCase());
    }
  });
});

describe("pagesOmittedMessage", () => {
  it("uses the singular form for exactly one omitted page", () => {
    expect(pagesOmittedMessage(1)).toBe("1 página no tenía texto y se omitió");
  });

  it("uses the plural form with the real count for more than one omitted page", () => {
    expect(pagesOmittedMessage(3)).toBe(
      "3 páginas no tenían texto y se omitieron",
    );
  });
});

describe("messageForIngestionErrorCode", () => {
  it.each([
    [INGESTION_ERROR.SESSION_REQUIRED, INGESTION_COPY.sessionRequired],
    [INGESTION_ERROR.NOTEBOOK_NOT_FOUND, INGESTION_COPY.notebookNotFound],
    [INGESTION_ERROR.NOTEBOOK_MISMATCH, INGESTION_COPY.notebookMismatch],
    [INGESTION_ERROR.PAGE_NOT_FOUND, INGESTION_COPY.pageNotFound],
    [INGESTION_ERROR.STORAGE_UNAVAILABLE, INGESTION_COPY.storageUnavailable],
    [INGESTION_ERROR.UNEXPECTED, INGESTION_COPY.unexpected],
    [DOCUMENT_FILE_ERROR.MIME_NOT_ALLOWED, INGESTION_COPY.invalidFileType],
    [DOCUMENT_FILE_ERROR.TOO_LARGE, INGESTION_COPY.fileTooLarge],
    [DOCUMENT_FILE_ERROR.FILE_NAME_INVALID, INGESTION_COPY.invalidFileName],
    [DOCUMENT_FILE_ERROR.PATH_OUT_OF_SCOPE, INGESTION_COPY.uploadExpired],
    [DOCUMENT_FILE_ERROR.UPLOAD_EXPIRED, INGESTION_COPY.uploadExpired],
    [DOCUMENT_FILE_ERROR.OBJECT_MISSING, INGESTION_COPY.uploadFailed],
    [DOCUMENT_FILE_ERROR.UNREADABLE, INGESTION_COPY.unreadablePdf],
    [
      DOCUMENT_FILE_ERROR.UNSUPPORTED_FORMAT,
      "Solo puedes importar archivos PDF, Word (.docx) o PowerPoint (.pptx).",
    ],
    [IMPORT_JOB_ERROR.NOT_FOUND, INGESTION_COPY.importNotFound],
    [IMPORT_JOB_ERROR.INVALID_TRANSITION, INGESTION_COPY.unexpected],
    [IMPORT_JOB_ERROR.STORAGE_PATH_CONFLICT, INGESTION_COPY.unexpected],
    ["INGESTION_INVALID_INPUT", INGESTION_COPY.invalidInput],
    [
      INGESTION_ERROR.RATE_LIMITED,
      "Llegaste al límite de importaciones por ahora. Intenta de nuevo más tarde.",
    ],
  ])("maps %s to its Spanish copy", (code, expected) => {
    expect(messageForIngestionErrorCode(code)).toBe(expected);
  });

  it("falls back to the generic unexpected message for an unknown code", () => {
    expect(messageForIngestionErrorCode("SOMETHING_ELSE")).toBe(
      INGESTION_COPY.unexpected,
    );
  });
});
