import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { listPagePickerTree } from "./list-page-picker-tree";
import { markPageArchived } from "./testing/archived-fixtures";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const NOW = new Date("2026-10-29T10:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";

// Phase 8 H14: the technique hubs' page pickers need each page's word
// count (100 words minimum to generate) without the page text.
describe("listPagePickerTree use case", () => {
  it("lists the active notebooks and pages with each page's word count, never its text", async () => {
    const deps = {
      notebooks: new InMemoryNotebookRepository(),
      pages: new InMemoryPageRepository(),
      clock: createFixedClock(NOW),
    };
    const notebook = await createNotebook({ title: "Bio" }, deps, OWNER_ID);
    if (!notebook.ok) throw new Error("setup failed");
    const long = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    const empty = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    const archived = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    if (!long.ok || !empty.ok || !archived.ok) throw new Error("setup failed");
    await deps.pages.update({
      ...long.value,
      plainText: "La mitocondria produce ATP.\nEl núcleo guarda el ADN.",
    });
    await markPageArchived(deps.pages, archived.value.id);

    const tree = await listPagePickerTree(deps, OWNER_ID);

    expect(tree).toEqual([
      {
        id: notebook.value.id,
        title: "Bio",
        pages: [
          { id: long.value.id, title: long.value.title, words: 9 },
          { id: empty.value.id, title: empty.value.title, words: 0 },
        ],
      },
    ]);
  });

  it("is empty for an owner without notebooks", async () => {
    const deps = {
      notebooks: new InMemoryNotebookRepository(),
      pages: new InMemoryPageRepository(),
    };

    expect(await listPagePickerTree(deps, OWNER_ID)).toEqual([]);
  });
});
