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

  put(path: string, object: FakeObject): void {
    this.objects.set(path, object);
  }

  async createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; bucket: string }> {
    this.signedUploadUrlCalls.push(path);
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
    const object = this.objects.get(path);
    if (!object) return null;
    return { sizeBytes: object.sizeBytes, mime: object.mime };
  }

  async download(path: string): Promise<Uint8Array | null> {
    this.downloadCalls.push(path);
    return this.objects.get(path)?.bytes ?? null;
  }
}
