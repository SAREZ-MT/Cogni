import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { archiveNotebook } from "./archive-notebook";
import { archivePage } from "./archive-page";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { listSidebar } from "./list-sidebar";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const NOW = new Date("2026-09-20T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    pages: new InMemoryPageRepository(),
    clock: createFixedClock(NOW),
  };
}

describe("listSidebar use case", () => {
  it("returns only active notebooks with their active pages, without content (Scenario: Arbol del owner)", async () => {
    const deps = makeDeps();
    const notebookA = await createNotebook({ title: "Activo" }, deps, OWNER_ID);
    const notebookB = await createNotebook(
      { title: "Archivado" },
      deps,
      OWNER_ID,
    );
    if (!notebookA.ok || !notebookB.ok) throw new Error("setup failed");
    await archiveNotebook({ notebookId: notebookB.value.id }, deps, OWNER_ID);

    const activePage = await createPage(
      { notebookId: notebookA.value.id },
      deps,
      OWNER_ID,
    );
    const archivedPage = await createPage(
      { notebookId: notebookA.value.id },
      deps,
      OWNER_ID,
    );
    if (!activePage.ok || !archivedPage.ok) throw new Error("setup failed");
    await archivePage({ pageId: archivedPage.value.id }, deps, OWNER_ID);

    const sidebar = await listSidebar(deps, OWNER_ID);

    expect(sidebar).toHaveLength(1);
    expect(sidebar[0]?.id).toBe(notebookA.value.id);
    expect(sidebar[0]?.pages).toHaveLength(1);
    expect(sidebar[0]?.pages[0]?.id).toBe(activePage.value.id);
    expect(sidebar[0]).not.toHaveProperty("content");
    expect(sidebar[0]?.pages[0]).not.toHaveProperty("content");
    expect(sidebar[0]?.pages[0]).not.toHaveProperty("plainText");
  });

  it("returns notebooks and pages in ascending position order", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook({ title: "Uno" }, deps, OWNER_ID);
    if (!notebook.ok) throw new Error("setup failed");
    await createPage(
      { notebookId: notebook.value.id, title: "Primera" },
      deps,
      OWNER_ID,
    );
    await createPage(
      { notebookId: notebook.value.id, title: "Segunda" },
      deps,
      OWNER_ID,
    );

    const sidebar = await listSidebar(deps, OWNER_ID);

    expect(sidebar[0]?.pages.map((page) => page.title)).toEqual([
      "Primera",
      "Segunda",
    ]);
  });
});
