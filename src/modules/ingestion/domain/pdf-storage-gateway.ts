// design.md, "Interfaces / Contracts" — the storage port `requestPdfUpload`
// and `startPdfImport` (application) depend on instead of a concrete
// Supabase client (`domain-is-pure`/`application-no-infra-or-ui` in
// .dependency-cruiser.cjs). `SupabasePdfStorageGateway` (T7) implements it
// against the private `page-pdfs` bucket; `FakePdfStorageGateway`
// (application/testing) implements it in memory for unit tests.
export interface PdfStorageGateway {
  createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; bucket: string }>;
  // null when the object does not exist; throws on a transient error
  // (T7b/T7c follow-up: R3-metadata-transient-error-as-missing) instead of
  // reporting it as missing.
  getObjectMetadata(
    path: string,
  ): Promise<{ sizeBytes: number; mime: string } | null>;
  // null when the object does not exist; throws on transient errors, which
  // `processImportJob` (T6) maps to `failed(download)`.
  download(
    path: string,
    options?: { signal?: AbortSignal },
  ): Promise<Uint8Array | null>;
}
