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
}
