import { describe, expect, it } from "vitest";
import type { Page } from "../../domain/page";
import type { PageRepository } from "../../domain/page-repository";

// Exported so a DB-backed test (tests/db/notebooks-repository.smoke.test.ts)
// can create matching profiles/notebooks rows before running this contract
// against DrizzlePageRepository, satisfying the owner_id/notebook_id FKs
// that the in-memory double does not have.
export const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
export const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
export const NOTEBOOK_ID = "9f8e7d6c-5b4a-4938-8271-605f4e3d2c1b";

export const DEFAULT_PAGE_ID = "1e2d3c4b-5a69-4788-9f01-2a3b4c5d6e7f";

export interface PageRepositoryContractIds {
  pageId?: string;
  ownerId?: string;
  otherOwnerId?: string;
  notebookId?: string;
}

function makePage(
  ids: Required<PageRepositoryContractIds>,
  overrides: Partial<Page> = {},
): Page {
  return {
    id: ids.pageId,
    ownerId: ids.ownerId,
    notebookId: ids.notebookId,
    title: "Sin título",
    content: { type: "doc", content: [] },
    plainText: "",
    contentVersion: 1,
    position: 1,
    archivedAt: null,
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    updatedAt: new Date("2026-09-20T10:00:00.000Z"),
    ...overrides,
  };
}

// Shared contract executed against every PageRepository implementation:
// the in-memory double now (phase 1), DrizzlePageRepository against
// Postgres later (phase 2). Both MUST implement updateIfVersion as a
// single atomic compare-and-swap, never read-compare-write. `ids` lets a
// DB-backed caller inject real owner/notebook uuids that satisfy foreign
// keys the in-memory double does not have.
export function runPageRepositoryContract(
  createRepository: () => PageRepository,
  idsOverride: PageRepositoryContractIds = {},
): void {
  const ids: Required<PageRepositoryContractIds> = {
    pageId: idsOverride.pageId ?? DEFAULT_PAGE_ID,
    ownerId: idsOverride.ownerId ?? OWNER_ID,
    otherOwnerId: idsOverride.otherOwnerId ?? OTHER_OWNER_ID,
    notebookId: idsOverride.notebookId ?? NOTEBOOK_ID,
  };

  describe("PageRepository.updateIfVersion contract", () => {
    it("updates and increments content_version when expectedVersion matches", async () => {
      const repository = createRepository();
      await repository.create(makePage(ids, { contentVersion: 3 }));

      const result = await repository.updateIfVersion({
        pageId: ids.pageId,
        ownerId: ids.ownerId,
        expectedVersion: 3,
        content: { type: "doc", content: [] },
        plainText: "hola",
        updatedAt: new Date("2026-09-20T11:00:00.000Z"),
      });

      expect(result).toEqual({ updated: true, version: 4 });
      const stored = await repository.findById(ids.pageId);
      expect(stored?.contentVersion).toBe(4);
      expect(stored?.plainText).toBe("hola");
    });

    it("rejects a stale expectedVersion without writing anything", async () => {
      const repository = createRepository();
      await repository.create(makePage(ids, { contentVersion: 4 }));

      const result = await repository.updateIfVersion({
        pageId: ids.pageId,
        ownerId: ids.ownerId,
        expectedVersion: 3,
        content: { type: "doc", content: [{ type: "text", text: "stale" }] },
        plainText: "stale",
        updatedAt: new Date("2026-09-20T11:00:00.000Z"),
      });

      expect(result).toEqual({ updated: false, currentVersion: 4 });
      const stored = await repository.findById(ids.pageId);
      expect(stored?.contentVersion).toBe(4);
      expect(stored?.plainText).toBe("");
    });

    it("rejects an update from a different owner", async () => {
      const repository = createRepository();
      await repository.create(makePage(ids, { contentVersion: 1 }));

      const result = await repository.updateIfVersion({
        pageId: ids.pageId,
        ownerId: ids.otherOwnerId,
        expectedVersion: 1,
        content: { type: "doc", content: [] },
        plainText: "intruso",
        updatedAt: new Date("2026-09-20T11:00:00.000Z"),
      });

      expect(result.updated).toBe(false);
      const stored = await repository.findById(ids.pageId);
      expect(stored?.contentVersion).toBe(1);
    });
  });
}
