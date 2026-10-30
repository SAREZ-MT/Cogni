import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/shared/config/env.client";
import { serverEnv } from "@/shared/config/env.server";
import type { ImportSourceStorage } from "../domain/content-deletion";
import type { StorageGateway } from "../domain/storage-gateway";

// Server-only adapter (design.md, "Subida de imagen firmada"): uses the
// service role key to issue signed upload/read grants and to read real
// object metadata, bypassing the bucket's RLS entirely. Ownership is
// already enforced by the application layer (RequestImageUpload,
// RegisterPageAsset, GetAssetReadUrl) before this gateway is called, so
// bypassing RLS here does not weaken the boundary — the RLS policies from
// 0004_page_assets_storage.sql are the second, independent layer that
// still applies to the browser's direct `uploadToSignedUrl` call, which
// authenticates with the end user's own session, not this service key.
function storageBucket(bucket: string = serverEnv().SUPABASE_STORAGE_BUCKET) {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  const { NEXT_PUBLIC_SUPABASE_URL } = clientEnv();
  const client = createClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return client.storage.from(bucket);
}

export class SupabaseStorageGateway implements StorageGateway {
  async createSignedUploadUrl(
    path: string,
  ): Promise<{ signedUrl: string; token: string; bucket: string }> {
    const { data, error } = await storageBucket().createSignedUploadUrl(path);
    if (error || !data) {
      throw error ?? new Error("failed to create a signed upload url");
    }
    return {
      signedUrl: data.signedUrl,
      token: data.token,
      bucket: serverEnv().SUPABASE_STORAGE_BUCKET,
    };
  }

  async createSignedUrl(
    path: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await storageBucket().createSignedUrl(
      path,
      expiresInSeconds,
    );
    if (error || !data) {
      throw error ?? new Error("failed to create a signed url");
    }
    return data.signedUrl;
  }

  async getObjectMetadata(
    path: string,
  ): Promise<{ sizeBytes: number; mime: string } | null> {
    const { data, error } = await storageBucket().info(path);
    if (error || !data) return null;
    if (typeof data.size !== "number" || !data.contentType) return null;
    return { sizeBytes: data.size, mime: data.contentType };
  }

  // document-import T9: the importer runs server-side, so it uploads with
  // this same service-role client (RLS bypassed; StoreImportedAsset has
  // already checked page ownership and the canonical path).
  async upload(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const { error } = await storageBucket().upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (error) throw error;
  }

  async remove(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await storageBucket().remove(paths);
    if (error) throw error;
  }
}

// Phase 8 H19: a deleted page's imported source documents (ingestion's
// SUPABASE_PDF_BUCKET, `{ownerId}/{uploadId}.{ext}`). Same service-role
// client; the delete use case already checked ownership in the database.
export class SupabaseImportSourceStorage implements ImportSourceStorage {
  async remove(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await storageBucket(
      serverEnv().SUPABASE_PDF_BUCKET,
    ).remove(paths);
    if (error) throw error;
  }
}
