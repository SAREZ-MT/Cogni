// Mirrors notebooks/domain/page-asset.ts's ALLOWED_MIME/MAX_ASSET_BYTES.
// Duplicated (not imported) for the same reason save-page-port.ts
// redeclares PAGE_VERSION_CONFLICT_CODE instead of importing it: a value
// import of `@/modules/notebooks` would pull its Server Actions' and
// application layer's server-only graph into the editor's client bundle
// just to read two constants. The server-side validation in
// RequestImageUpload/RegisterPageAsset remains authoritative; this copy
// only powers the client's early, non-authoritative check (design.md,
// "valida MIME/tamaño en cliente antes de pedir el permiso").
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
