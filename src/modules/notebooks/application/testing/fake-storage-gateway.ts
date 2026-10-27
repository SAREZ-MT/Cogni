import type { StorageGateway } from "../../domain/storage-gateway";

// Test double for the StorageGateway port. Objects are "uploaded" by
// calling put() from a test, simulating the browser's direct upload to
// Supabase Storage after createSignedUploadUrl.
export class FakeStorageGateway implements StorageGateway {
  private readonly objects = new Map<
    string,
    { sizeBytes: number; mime: string }
  >();

  // Records every call so tests can assert a rejected use case never
  // reaches Storage (specs/page-assets/spec.md, Scenarios "MIME no
  // permitido"/"Tamaño excedido": "no contacta a Storage").
  readonly signedUploadUrlCalls: string[] = [];
  // document-import T9: server-side uploads and removals.
  readonly uploadCalls: Array<{
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }> = [];
  readonly removeCalls: string[][] = [];
  private nextUploadError: Error | null = null;
  private nextRemoveError: Error | null = null;
  private storedMimeOverride: string | null = null;

  failNextUpload(error: Error): void {
    this.nextUploadError = error;
  }

  failNextRemove(error: Error): void {
    this.nextRemoveError = error;
  }

  // Makes every later upload store this type instead of the declared one,
  // so tests can exercise RegisterPageAsset's real-object revalidation.
  overrideStoredMime(mime: string): void {
    this.storedMimeOverride = mime;
  }

  has(path: string): boolean {
    return this.objects.has(path);
  }

  put(path: string, metadata: { sizeBytes: number; mime: string }): void {
    this.objects.set(path, metadata);
  }

  async createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; bucket: string }> {
    this.signedUploadUrlCalls.push(path);
    return {
      signedUrl: `https://fake.local/upload/${path}`,
      token: "fake-token",
      bucket: "fake-bucket",
    };
  }

  async createSignedUrl(path: string): Promise<string> {
    return `https://fake.local/read/${path}`;
  }

  async getObjectMetadata(
    path: string,
  ): Promise<{ sizeBytes: number; mime: string } | null> {
    return this.objects.get(path) ?? null;
  }

  async upload(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    this.uploadCalls.push({ path, bytes, contentType });
    if (this.nextUploadError) {
      const error = this.nextUploadError;
      this.nextUploadError = null;
      throw error;
    }
    this.objects.set(path, {
      sizeBytes: bytes.length,
      mime: this.storedMimeOverride ?? contentType,
    });
  }

  async remove(paths: string[]): Promise<void> {
    this.removeCalls.push(paths);
    if (this.nextRemoveError) {
      const error = this.nextRemoveError;
      this.nextRemoveError = null;
      throw error;
    }
    for (const path of paths) this.objects.delete(path);
  }
}
