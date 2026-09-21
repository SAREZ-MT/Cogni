import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createPage, DEFAULT_PAGE_TITLE } from "./page";

const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const NOTEBOOK_ID = "9f8e7d6c-5b4a-4938-8271-605f4e3d2c1b";

describe("createPage", () => {
  it('creates a new page with "Sin titulo" and version 1 (Scenario: Pagina nueva con valores iniciales)', () => {
    const result = createPage(
      { id: "0", ownerId: OWNER_ID, notebookId: NOTEBOOK_ID, position: 1 },
      createFixedClock(NOW),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe(DEFAULT_PAGE_TITLE);
    expect(result.value.contentVersion).toBe(1);
    expect(result.value.plainText).toBe("");
    expect(result.value.archivedAt).toBeNull();
    expect(result.value.content).toEqual({ type: "doc", content: [] });
    expect(result.value.notebookId).toBe(NOTEBOOK_ID);
    expect(result.value.ownerId).toBe(OWNER_ID);
  });

  it("keeps an explicit title", () => {
    const result = createPage(
      {
        id: "0",
        ownerId: OWNER_ID,
        notebookId: NOTEBOOK_ID,
        title: "Repaso final",
        position: 1,
      },
      createFixedClock(NOW),
    );

    expect(result.ok && result.value.title).toBe("Repaso final");
  });

  it("rejects a blank explicit title, sharing Notebook's title rule", () => {
    const result = createPage(
      {
        id: "0",
        ownerId: OWNER_ID,
        notebookId: NOTEBOOK_ID,
        title: "   ",
        position: 1,
      },
      createFixedClock(NOW),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("NOTEBOOK_INVALID_TITLE");
  });
});
