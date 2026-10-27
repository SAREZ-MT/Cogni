import type { Clock } from "@/shared/kernel/clock";
import { DomainError } from "@/shared/kernel/domain-error";
import { createId } from "@/shared/kernel/id";
import { err, ok, type Result } from "@/shared/kernel/result";
import { ASSET_ERROR, PAGE_ERROR } from "../domain/errors";
import {
  canonicalAssetStoragePath,
  validateAssetInput,
} from "../domain/page-asset";
import type { PageAssetRepository } from "../domain/page-asset-repository";
import type { PageRepository } from "../domain/page-repository";
import type { StorageGateway } from "../domain/storage-gateway";
import { registerPageAsset } from "./register-page-asset";

export interface StoreImportedAssetInput {
  pageId: string;
  bytes: Uint8Array;
  mime: string;
}

// document-import T9: the server-side twin of RequestImageUpload +
// browser upload + RegisterPageAsset, for an image the importer extracted
// from a document. Same rules in the same order: owned active page,
// allowed mime and size (checked before touching Storage), canonical
// `{ownerId}/{pageId}/{fileId}.{ext}` path; then the bytes are uploaded and
// RegisterPageAsset (reused, not duplicated) revalidates the real object
// and inserts the page_assets row. The returned assetId is that row's id,
// the value the editor's image node stores. Never throws: a Storage
// failure is err(ASSET_UPLOAD_FAILED), and an object that registration
// rejects is removed again (best effort).
export async function storeImportedAsset(
  input: StoreImportedAssetInput,
  deps: {
    pages: PageRepository;
    assets: PageAssetRepository;
    storage: StorageGateway;
    clock: Clock;
  },
  ownerId: string,
): Promise<Result<{ assetId: string }, DomainError>> {
  const sizeBytes = input.bytes.length;
  const validated = validateAssetInput({ mime: input.mime, sizeBytes });
  if (!validated.ok) return validated;

  const page = await deps.pages.findById(input.pageId);
  if (!page || page.ownerId !== ownerId || page.archivedAt) {
    return err(new DomainError(PAGE_ERROR.NOT_FOUND, input.pageId));
  }

  const storagePath = canonicalAssetStoragePath(
    ownerId,
    page.id,
    createId(),
    input.mime,
  );
  try {
    await deps.storage.upload(storagePath, input.bytes, input.mime);
  } catch {
    return err(new DomainError(ASSET_ERROR.UPLOAD_FAILED, storagePath));
  }

  let registered: Awaited<ReturnType<typeof registerPageAsset>>;
  try {
    registered = await registerPageAsset(
      { pageId: page.id, storagePath, mime: input.mime, sizeBytes },
      deps,
      ownerId,
    );
  } catch {
    registered = err(new DomainError(ASSET_ERROR.UPLOAD_FAILED, storagePath));
  }
  if (!registered.ok) {
    try {
      await deps.storage.remove([storagePath]);
    } catch {
      // Best effort: an orphan object is harmless and owner-scoped.
    }
    return registered;
  }
  return ok({ assetId: registered.value.id });
}
