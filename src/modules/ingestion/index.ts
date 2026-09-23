// Public API of the "ingestion" module (documento-maestro §5.3.5,
// `cross-module-via-index`: no cross-module import may reach past this
// file). Client-importable: the four Server Actions below carry Next's
// "use server" directive (actions.ts), so importing them here never pulls
// `infrastructure` — Drizzle, the Supabase client or `unpdf` — into a
// client bundle. Everything else exported is a pure type or constant from
// `domain`/`application`, or a "use client" UI component. T13 will add
// `getActiveImports`/`ActiveImportsProvider`/`ImportingPageBadge`.
export {
  getImportJobStatus,
  processPdfImport,
  requestPdfUpload,
  startPdfImport,
} from "./actions";
export type {
  ImportJobStatusView,
  PdfUploadGrant,
  StartPdfImportResult,
} from "./application";
export {
  IMPORT_JOB_ERROR,
  IMPORT_JOB_STATUS,
  type ImportJobStatus,
  INGESTION_ERROR,
  MAX_DURATION_S,
  PDF_FILE_ERROR,
} from "./domain";
export { ImportPdfMenuItem } from "./ui/import-pdf-menu-item";
export { ImportProgress } from "./ui/import-progress";
export { PageImportView } from "./ui/page-import-view";
export {
  PdfImportProvider,
  useNotebookImport,
} from "./ui/pdf-import-provider";
