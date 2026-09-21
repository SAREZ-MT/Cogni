import { DomainError } from "@/shared/kernel/domain-error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { ASSET_ERROR } from "./errors";

// Pure validation, no Storage SDK (design.md, "Subida de imagen firmada").
// Reused by RequestImageUpload (client-declared metadata, first level of
// rejection) and by RegisterPageAsset (the real object's metadata, second
// level of rejection).
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB, product decision #3

export function validateAssetInput(input: {
  mime: string;
  sizeBytes: number;
}): Result<void, DomainError> {
  if (!(ALLOWED_MIME as readonly string[]).includes(input.mime)) {
    return err(new DomainError(ASSET_ERROR.MIME_NOT_ALLOWED, input.mime));
  }
  if (input.sizeBytes > MAX_ASSET_BYTES) {
    return err(new DomainError(ASSET_ERROR.TOO_LARGE, String(input.sizeBytes)));
  }
  return ok(undefined);
}

// One file name segment as RequestImageUpload generates it: `{assetId}.{ext}`
// with no dots, slashes or percent-escapes anywhere else, so neither a
// literal nor an encoded dot-segment can appear.
const FILE_NAME = /^[A-Za-z0-9_-]+\.[a-z0-9]+$/;

// specs/page-assets/spec.md, "Registro de PageAsset con revalidación": the
// storagePath a client hands back must be exactly
// `{ownerId}/{pageId}/{assetId}.{ext}`. A prefix check alone is not enough:
// the service-role gateway hands the key to an HTTP client that normalises
// `..` segments, so `{ownerId}/{pageId}/../../other/x.png` would resolve to
// another owner's object while still "starting with" the caller's prefix.
export function isCanonicalStoragePath(
  ownerId: string,
  pageId: string,
  storagePath: string,
): boolean {
  const segments = storagePath.split("/");
  return (
    segments.length === 3 &&
    segments[0] === ownerId &&
    segments[1] === pageId &&
    FILE_NAME.test(segments[2] ?? "")
  );
}
