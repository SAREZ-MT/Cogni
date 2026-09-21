// Port over Supabase Storage (implemented in phase 6 by
// SupabaseStorageGateway; FakeStorageGateway is the in-memory test double).
export interface StorageGateway {
  // `bucket` is included so the browser can call the real supabase-js
  // `storage.from(bucket).uploadToSignedUrl(...)` helper: the bucket name
  // (SUPABASE_STORAGE_BUCKET) is a server-only env var, and the browser
  // otherwise has no way to know it (design.md deviation, PR6: the
  // published contract only listed storagePath/signedUrl/token/expiresAt;
  // `bucket` is not secret, just an identifier, so returning it here is
  // simpler and safer than reimplementing the SDK's multipart upload
  // semantics with a raw fetch against the bare signed URL).
  createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; bucket: string }>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
  // Reads the real, already-uploaded object so RegisterPageAsset can
  // persist the actual mime/size instead of trusting the client's
  // declared values (design.md, "Subida de imagen firmada").
  getObjectMetadata(
    path: string,
  ): Promise<{ sizeBytes: number; mime: string } | null>;
}
