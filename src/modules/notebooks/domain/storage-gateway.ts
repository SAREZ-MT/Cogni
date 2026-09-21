// Port over Supabase Storage (implemented in phase 6 by
// SupabaseStorageGateway; FakeStorageGateway is the in-memory test double).
export interface StorageGateway {
  createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string }>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
  // Reads the real, already-uploaded object so RegisterPageAsset can
  // persist the actual mime/size instead of trusting the client's
  // declared values (design.md, "Subida de imagen firmada").
  getObjectMetadata(
    path: string,
  ): Promise<{ sizeBytes: number; mime: string } | null>;
}
