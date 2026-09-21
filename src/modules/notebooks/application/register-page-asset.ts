import { z } from "zod";
import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import { ASSET_ERROR, PAGE_ERROR } from "../domain/errors";
import {
  isCanonicalStoragePath,
  validateAssetInput,
} from "../domain/page-asset";
import type {
  PageAsset,
  PageAssetRepository,
} from "../domain/page-asset-repository";
import type { PageRepository } from "../domain/page-repository";
import type { StorageGateway } from "../domain/storage-gateway";
import { parseInput } from "./validation";

export const registerPageAssetSchema = z.object({
  pageId: z.string(),
  storagePath: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().positive(),
});

// design.md, "Subida de imagen firmada": revalidates ownership and the
// canonical `{ownerId}/{pageId}/{assetId}.{ext}` path, then trusts only the real object's
// metadata (never the client-declared mime/sizeBytes) before persisting.
// Idempotent on storagePath (specs/page-assets/spec.md, "Registro
// repetido").
export async function registerPageAsset(
  input: unknown,
  deps: {
    pages: PageRepository;
    assets: PageAssetRepository;
    storage: StorageGateway;
    clock: Clock;
  },
  ownerId: string,
): Promise<Result<PageAsset, DomainError>> {
  const parsed = parseInput(registerPageAssetSchema, input);
  if (!parsed.ok) return parsed;

  const page = await deps.pages.findById(parsed.value.pageId);
  if (!page || page.ownerId !== ownerId || page.archivedAt) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, parsed.value.pageId));
  }

  // Exact `{ownerId}/{pageId}/{assetId}.{ext}` shape, not a prefix check:
  // see isCanonicalStoragePath for why a prefix alone is escapable.
  if (!isCanonicalStoragePath(ownerId, page.id, parsed.value.storagePath)) {
    return err(
      new DomainError(ASSET_ERROR.PATH_OUT_OF_SCOPE, parsed.value.storagePath),
    );
  }

  const existing = await deps.assets.findByStoragePath(
    parsed.value.storagePath,
  );
  if (existing) return ok(existing);

  const metadata = await deps.storage.getObjectMetadata(
    parsed.value.storagePath,
  );
  if (!metadata) {
    return err(
      new DomainError(ASSET_ERROR.FORBIDDEN, parsed.value.storagePath),
    );
  }

  const validated = validateAssetInput(metadata);
  if (!validated.ok) return validated;

  const now = deps.clock.now();
  const asset: PageAsset = {
    id: createId(),
    ownerId,
    pageId: page.id,
    storagePath: parsed.value.storagePath,
    mime: metadata.mime,
    sizeBytes: metadata.sizeBytes,
    createdAt: now,
    updatedAt: now,
  };
  await deps.assets.upsert(asset);
  return ok(asset);
}
