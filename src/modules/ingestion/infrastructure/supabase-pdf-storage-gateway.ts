import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { PdfStorageGateway } from "../domain/pdf-storage-gateway";

// design.md, "ingestion define su propio PdfStorageGateway y el adaptador
// SupabasePdfStorageGateway... El adaptador recibe { supabaseUrl,
// serviceRoleKey, bucket } por constructor, sin leer variables de entorno;
// actions.ts le pasa los valores de serverEnv()." Server-only: the service
// role key must never reach a client bundle.
export interface SupabasePdfStorageGatewayConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
}

// A safe wrapper so callers and logs never see the raw Supabase
// StorageError shape (which may carry internal detail) — only a sanitized
// message, with the original preserved as `cause` for server-side
// diagnostics (never sent to the client: requestPdfUpload's caller only
// sees this thrown from actions.ts, T8, which never forwards `cause`).
export class PdfStorageAdapterError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PdfStorageAdapterError";
  }
}

export class SupabasePdfStorageGateway implements PdfStorageGateway {
  private readonly bucket: string;
  private readonly client: ReturnType<typeof createClient>;

  constructor(config: SupabasePdfStorageGatewayConfig) {
    this.bucket = config.bucket;
    this.client = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private storage() {
    return this.client.storage.from(this.bucket);
  }

  async createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; bucket: string }> {
    const { data, error } = await this.storage().createSignedUploadUrl(path);
    if (error || !data) {
      throw new PdfStorageAdapterError("failed to create a signed upload url", {
        cause: error,
      });
    }
    return {
      signedUrl: data.signedUrl,
      token: data.token,
      bucket: this.bucket,
    };
  }

  async getObjectMetadata(
    path: string,
  ): Promise<{ sizeBytes: number; mime: string } | null> {
    const { data, error } = await this.storage().info(path);
    if (error || !data) return null;
    if (typeof data.size !== "number" || !data.contentType) return null;
    return { sizeBytes: data.size, mime: data.contentType };
  }

  // null when the object does not exist (a resolved response with an
  // error); a network-level failure (e.g. our own AbortSignal.timeout
  // firing) throws before the client resolves, and is left to propagate —
  // processImportJob already wraps this call in try/catch and treats both
  // outcomes as fail(download).
  async download(
    path: string,
    options?: { signal?: AbortSignal },
  ): Promise<Uint8Array | null> {
    const { data, error } = await this.storage().download(
      path,
      {},
      options?.signal ? { signal: options.signal } : undefined,
    );
    if (error || !data) return null;
    const buffer = await data.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
