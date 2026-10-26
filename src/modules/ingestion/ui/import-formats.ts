import { DOCUMENT_MIME } from "../domain/document-file";
import {
  DOCUMENT_FORMATS,
  type DocumentFormat,
} from "../domain/document-format";

// document-import T11: the formats the picker offers. The pipeline reads
// every DOCUMENT_FORMATS entry, but a format joins the UI only once its
// adapter exists — PPTX lands with T7, and enabling it is removing it from
// this set (plus the invalid-type copy in ingestion-copy.ts).
export const NOT_YET_IMPORTABLE_IN_UI: ReadonlySet<DocumentFormat> = new Set([
  "pptx",
]);

export const UI_IMPORT_FORMATS: readonly DocumentFormat[] =
  DOCUMENT_FORMATS.filter((format) => !NOT_YET_IMPORTABLE_IN_UI.has(format));

const UI_IMPORT_MIMES: readonly string[] = UI_IMPORT_FORMATS.map(
  (format) => DOCUMENT_MIME[format],
);

// The hidden file input's `accept`: extensions first (what the OS picker
// filters on), then the mimes.
export const IMPORT_INPUT_ACCEPT = [
  ...UI_IMPORT_FORMATS.map((format) => `.${format}`),
  ...UI_IMPORT_MIMES,
].join(",");

const EXTENSION = /\.([a-z0-9]+)$/i;

// The mime the upload declares for a picked file, or null when the picker
// does not take it. A declared type must be one of the offered mimes; a
// file with no type at all (some systems report "" for Office files) is
// judged by its extension. The server checks the real bytes either way.
export function importMimeOf(file: {
  name: string;
  type: string;
}): string | null {
  if (file.type !== "") {
    return UI_IMPORT_MIMES.includes(file.type) ? file.type : null;
  }
  const extension = EXTENSION.exec(file.name)?.[1]?.toLowerCase();
  const format = UI_IMPORT_FORMATS.find((candidate) => candidate === extension);
  return format ? DOCUMENT_MIME[format] : null;
}
