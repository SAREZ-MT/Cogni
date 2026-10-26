import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/shared/db/client";
import { type PageAssetRow, pageAssets } from "@/shared/db/schema";
import type {
  PageAsset,
  PageAssetRepository,
} from "../domain/page-asset-repository";

function toPageAsset(row: PageAssetRow): PageAsset {
  return {
    id: row.id,
    ownerId: row.ownerId,
    pageId: row.pageId,
    storagePath: row.storagePath,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePageAssetRepository implements PageAssetRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<PageAsset | null> {
    const row = await this.db.query.pageAssets.findFirst({
      where: eq(pageAssets.id, id),
    });
    return row ? toPageAsset(row) : null;
  }

  async findByStoragePath(storagePath: string): Promise<PageAsset | null> {
    const row = await this.db.query.pageAssets.findFirst({
      where: eq(pageAssets.storagePath, storagePath),
    });
    return row ? toPageAsset(row) : null;
  }

  // Idempotent on storage_path: RegisterPageAsset may be invoked more than
  // once for the same uploaded object (design.md).
  async upsert(asset: PageAsset): Promise<void> {
    await this.db
      .insert(pageAssets)
      .values({
        id: asset.id,
        ownerId: asset.ownerId,
        pageId: asset.pageId,
        storagePath: asset.storagePath,
        mime: asset.mime,
        sizeBytes: asset.sizeBytes,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      })
      .onConflictDoUpdate({
        target: pageAssets.storagePath,
        set: {
          mime: asset.mime,
          sizeBytes: asset.sizeBytes,
          updatedAt: asset.updatedAt,
        },
      });
  }

  async deleteByIds(
    ownerId: string,
    ids: readonly string[],
  ): Promise<PageAsset[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .delete(pageAssets)
      .where(
        and(eq(pageAssets.ownerId, ownerId), inArray(pageAssets.id, [...ids])),
      )
      .returning();
    return rows.map(toPageAsset);
  }
}
