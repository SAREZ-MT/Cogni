import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { renamePage } from "./rename-page";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

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

describe("renamePage use case", () => {
  it("renames a page owned by the caller", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await renamePage(
      { pageId: page.id, title: "Repaso final" },
      deps,
      OWNER_ID,
    );

    expect(result.ok && result.value.title).toBe("Repaso final");
  });

  it("rejects a blank title", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await renamePage(
      { pageId: page.id, title: "  " },
      deps,
      OWNER_ID,
    );

    expect(result.ok).toBe(false);
    const stored = await deps.pages.findById(page.id);
    expect(stored?.title).toBe(page.title);
  });

  it("rejects renaming a page owned by another user (Scenario: Pagina ajena)", async () => {
    const deps = makeDeps();
    const page = await setupPage(deps);

    const result = await renamePage(
      { pageId: page.id, title: "Robado" },
      deps,
      OTHER_OWNER_ID,
    );

    expect(result.ok).toBe(false);
    const stored = await deps.pages.findById(page.id);
    expect(stored?.title).toBe(page.title);
  });
});
