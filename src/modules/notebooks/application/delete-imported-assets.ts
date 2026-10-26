import type { PageAssetRepository } from "../domain/page-asset-repository";
import type { StorageGateway } from "../domain/storage-gateway";

// document-import T9: best-effort cleanup the importer runs when writing
// the imported content fails after its images were already stored
// (StoreImportedAsset). Deletes only the caller's rows (ids of other
// owners are ignored), then removes their Storage objects. Never throws:
// a leftover row or object is owner-scoped and unreferenced, so it is
// logged, not surfaced.
export async function deleteImportedAssets(
  assetIds: readonly string[],
  deps: { assets: PageAssetRepository; storage: StorageGateway },
  ownerId: string,
): Promise<void> {
  if (assetIds.length === 0) return;
  try {
    const deleted = await deps.assets.deleteByIds(ownerId, assetIds);
    if (deleted.length === 0) return;
    await deps.storage.remove(deleted.map((asset) => asset.storagePath));
  } catch (error) {
    console.error("notebooks: deleteImportedAssets failed", {
      count: assetIds.length,
      error,
    });
  }
}
