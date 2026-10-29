import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { getPage } from "./get-page";
import { renamePage } from "./rename-page";
import { savePage } from "./save-page";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

// Requirement "Autorizacion por propiedad", Scenario "Pagina ajena":
// GetPage, RenamePage, ArchivePage and SavePage all treat another user's
// page as if it did not exist, and never mutate it.
const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    pages: new InMemoryPageRepository(),
    clock: createFixedClock(NOW),
  };
}

async function setupPage(deps: ReturnType<typeof makeDeps>) {
  const notebook = await createNotebook({ title: "Calculo I" }, deps, OWNER_ID);
  if (!notebook.ok) throw new Error("setup failed");
  const page = await createPage(
    { notebookId: notebook.value.id },
    deps,
    OWNER_ID,
  );
  if (!page.ok) throw new Error("setup failed");
  return page.value;
}

describe("cross-owner authorization (Scenario: Pagina ajena)", () => {
  it("GetPage returns a DomainError and no data", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await getPage({ pageId: page.id }, deps, OTHER_OWNER_ID);

    expect(result.ok).toBe(false);
  });

  it("RenamePage returns a DomainError and does not rename", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await renamePage(
      { pageId: page.id, title: "Robado" },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect((await deps.pages.findById(page.id))?.title).toBe(page.title);
  });

  it("SavePage returns a DomainError and does not write", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await savePage(
      {
        pageId: page.id,
        content: { type: "doc", content: [] },
        expectedVersion: 1,
      },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    expect((await deps.pages.findById(page.id))?.contentVersion).toBe(1);
  });
});
