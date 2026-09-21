import { describe, expect, it } from "vitest";
import type { Page } from "../../domain/page";
import type { PageRepository } from "../../domain/page-repository";

const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";
const NOTEBOOK_ID = "9f8e7d6c-5b4a-4938-8271-605f4e3d2c1b";

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: "page-1",
    ownerId: OWNER_ID,
    notebookId: NOTEBOOK_ID,
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
// single atomic compare-and-swap, never read-compare-write.
export function runPageRepositoryContract(
  createRepository: () => PageRepository,
): void {
  describe("PageRepository.updateIfVersion contract", () => {
    it("updates and increments content_version when expectedVersion matches", async () => {
      const repository = createRepository();
      await repository.create(makePage({ contentVersion: 3 }));

      const result = await repository.updateIfVersion({
        pageId: "page-1",
        ownerId: OWNER_ID,
        expectedVersion: 3,
        content: { type: "doc", content: [] },
        plainText: "hola",
        updatedAt: new Date("2026-09-20T11:00:00.000Z"),
      });

      expect(result).toEqual({ updated: true, version: 4 });
      const stored = await repository.findById("page-1");
      expect(stored?.contentVersion).toBe(4);
      expect(stored?.plainText).toBe("hola");
    });

    it("rejects a stale expectedVersion without writing anything", async () => {
      const repository = createRepository();
      await repository.create(makePage({ contentVersion: 4 }));

      const result = await repository.updateIfVersion({
        pageId: "page-1",
        ownerId: OWNER_ID,
        expectedVersion: 3,
        content: { type: "doc", content: [{ type: "text", text: "stale" }] },
        plainText: "stale",
        updatedAt: new Date("2026-09-20T11:00:00.000Z"),
      });

      expect(result).toEqual({ updated: false, currentVersion: 4 });
      const stored = await repository.findById("page-1");
      expect(stored?.contentVersion).toBe(4);
      expect(stored?.plainText).toBe("");
    });

    it("rejects an update from a different owner", async () => {
      const repository = createRepository();
      await repository.create(makePage({ contentVersion: 1 }));

      const result = await repository.updateIfVersion({
        pageId: "page-1",
        ownerId: OTHER_OWNER_ID,
        expectedVersion: 1,
        content: { type: "doc", content: [] },
        plainText: "intruso",
        updatedAt: new Date("2026-09-20T11:00:00.000Z"),
      });

      expect(result.updated).toBe(false);
      const stored = await repository.findById("page-1");
      expect(stored?.contentVersion).toBe(1);
    });
  });
}
