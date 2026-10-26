// Minimal shape needed by the port; the full validated entity
// (page-asset.ts, with validateAssetInput and the MIME/size rules) is
// created in the image-upload slice (design.md, "Subida de imagen firmada").
export interface PageAsset {
  readonly id: string;
  readonly ownerId: string;
  readonly pageId: string;
  readonly storagePath: string;
  readonly mime: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Port implemented by infrastructure (Drizzle, phase 6) and by the
// in-memory test double (phase 1). Upsert is idempotent on storage_path
// (design.md), since RegisterPageAsset may be called more than once for
// the same uploaded object.
export interface PageAssetRepository {
  findById(id: string): Promise<PageAsset | null>;
  findByStoragePath(storagePath: string): Promise<PageAsset | null>;
  upsert(asset: PageAsset): Promise<void>;
  // document-import T9: deletes the rows among `ids` owned by `ownerId`
  // (never anyone else's) and returns them, so the caller can remove their
  // Storage objects. Unknown or foreign ids are ignored.
  deleteByIds(ownerId: string, ids: readonly string[]): Promise<PageAsset[]>;
}
