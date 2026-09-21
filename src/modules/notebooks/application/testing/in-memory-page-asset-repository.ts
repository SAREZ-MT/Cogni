import type {
  PageAsset,
  PageAssetRepository,
} from "../../domain/page-asset-repository";

// Test double for the PageAssetRepository port. upsert is idempotent on
// storage_path, mirroring the SQL adapter's unique constraint.
export class InMemoryPageAssetRepository implements PageAssetRepository {
  private readonly rows = new Map<string, PageAsset>();

  async findById(id: string): Promise<PageAsset | null> {
    return this.rows.get(id) ?? null;
  }

  async findByStoragePath(storagePath: string): Promise<PageAsset | null> {
    for (const asset of this.rows.values()) {
      if (asset.storagePath === storagePath) return asset;
    }
    return null;
  }

  async upsert(asset: PageAsset): Promise<void> {
    for (const [id, existing] of this.rows) {
      if (existing.storagePath === asset.storagePath && id !== asset.id) {
        this.rows.delete(id);
      }
    }
    this.rows.set(asset.id, asset);
  }

  count(): number {
    return this.rows.size;
  }
}
