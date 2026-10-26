// Public API of the "ingestion" module (documento-maestro §5.3.5,
// `cross-module-via-index`: no cross-module import may reach past this
// file). Client-importable: the five Server Actions below carry Next's
// "use server" directive (actions.ts), so importing them here never pulls
// `infrastructure` — Drizzle, the Supabase client or `unpdf` — into a
// client bundle. Everything else exported is a pure type or constant from
// `domain`/`application`, or a "use client" UI component.
export {
  getActiveImports,
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
  DOCUMENT_FILE_ERROR,
  IMPORT_JOB_ERROR,
  IMPORT_JOB_STATUS,
  type ImportJobStatus,
  INGESTION_ERROR,
  MAX_DURATION_S,
} from "./domain";
export {
  ActiveImportsProvider,
  useIsImporting,
} from "./ui/active-imports-provider";
export { ImportPdfMenuItem } from "./ui/import-pdf-menu-item";
export { ImportProgress } from "./ui/import-progress";
export { ImportingPageBadge } from "./ui/importing-page-badge";
export { PageImportView } from "./ui/page-import-view";
export {
  PdfImportProvider,
  useNotebookImport,
} from "./ui/pdf-import-provider";
