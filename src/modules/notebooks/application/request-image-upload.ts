import { z } from "zod";
import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import { PAGE_ERROR } from "../domain/errors";
import { validateAssetInput } from "../domain/page-asset";
import type { PageRepository } from "../domain/page-repository";
import type { StorageGateway } from "../domain/storage-gateway";
import { parseInput } from "./validation";

export const requestImageUploadSchema = z.object({
  pageId: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().positive(),
});

const EXTENSION_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface ImageUploadGrant {
  storagePath: string;
  signedUrl: string;
  token: string;
  bucket: string;
}

// design.md, "Subida de imagen firmada, RequestImageUpload +
// RegisterPageAsset + GetAssetReadUrl": verifies the page is active and
// owned, validates the client-declared mime/size (first level of
// rejection, before touching Storage) and issues a signed upload grant to
// the canonical `{ownerId}/{pageId}/{assetId}.{ext}` path.
export async function requestImageUpload(
  input: unknown,
  deps: { pages: PageRepository; storage: StorageGateway },
  ownerId: string,
): Promise<Result<ImageUploadGrant, DomainError>> {
  const parsed = parseInput(requestImageUploadSchema, input);
  if (!parsed.ok) return parsed;

  const page = await deps.pages.findById(parsed.value.pageId);
  if (!page || page.ownerId !== ownerId || page.archivedAt) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, parsed.value.pageId));
  }

  const validated = validateAssetInput(parsed.value);
  if (!validated.ok) return validated;

  const extension = EXTENSION_FOR_MIME[parsed.value.mime] ?? "bin";
  const storagePath = `${ownerId}/${page.id}/${createId()}.${extension}`;
  const { signedUrl, token, bucket } =
    await deps.storage.createSignedUploadUrl(storagePath);
  return ok({ storagePath, signedUrl, token, bucket });
}
