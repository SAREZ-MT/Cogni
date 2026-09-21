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
