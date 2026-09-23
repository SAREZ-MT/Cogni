import type { PdfStorageGateway } from "../../domain/pdf-storage-gateway";

interface FakeObject {
  sizeBytes: number;
  mime: string;
  bytes?: Uint8Array;
}

// Test double for the PdfStorageGateway port. Objects are "uploaded" by
// calling put() from a test, simulating the browser's direct upload to
// Supabase Storage after createSignedUploadUrl (mirrors notebooks'
// FakeStorageGateway). Reused by T6, which also exercises download().
export class FakePdfStorageGateway implements PdfStorageGateway {
  private readonly objects = new Map<string, FakeObject>();

  // Records every call so tests can assert a rejected use case never
  // reaches Storage (design.md's failure table: "sin consultar Storage").
  readonly signedUploadUrlCalls: string[] = [];
  readonly getObjectMetadataCalls: string[] = [];
  readonly downloadCalls: string[] = [];

  // T8: lets `requestPdfUpload`/`startPdfImport` tests exercise the
  // INGESTION_STORAGE_UNAVAILABLE mapping (T7c follow-up:
  // R3-metadata-throw-callers-unproved) the way the real
  // SupabasePdfStorageGateway throws PdfStorageAdapterError for a
  // transient failure. Consumed once, then the gateway behaves normally
  // again, matching a genuinely transient error.
  private forcedCreateSignedUploadUrlError: Error | null = null;
  private forcedGetObjectMetadataError: Error | null = null;

  put(path: string, object: FakeObject): void {
    this.objects.set(path, object);
  }

  forceNextCreateSignedUploadUrlError(error: Error): void {
    this.forcedCreateSignedUploadUrlError = error;
  }

  forceNextGetObjectMetadataError(error: Error): void {
    this.forcedGetObjectMetadataError = error;
  }

  async createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; bucket: string }> {
    this.signedUploadUrlCalls.push(path);
    if (this.forcedCreateSignedUploadUrlError) {
      const error = this.forcedCreateSignedUploadUrlError;
      this.forcedCreateSignedUploadUrlError = null;
      throw error;
    }
    return {
      signedUrl: `https://fake.local/upload/${path}`,
      token: "fake-token",
      bucket: "page-pdfs",
    };
  }

  async getObjectMetadata(
    path: string,
  ): Promise<{ sizeBytes: number; mime: string } | null> {
    this.getObjectMetadataCalls.push(path);
    if (this.forcedGetObjectMetadataError) {
      const error = this.forcedGetObjectMetadataError;
      this.forcedGetObjectMetadataError = null;
      throw error;
    }
    const object = this.objects.get(path);
    if (!object) return null;
    return { sizeBytes: object.sizeBytes, mime: object.mime };
  }

  async download(path: string): Promise<Uint8Array | null> {
    this.downloadCalls.push(path);
    return this.objects.get(path)?.bytes ?? null;
  }
}
