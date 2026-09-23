import { describe, expect, it } from "vitest";
import { createFixedClock } from "@/shared/kernel/clock";
import { createNotebook } from "./create-notebook";
import { createPage } from "./create-page";
import { getHomeOverview } from "./get-home-overview";
import { InMemoryNotebookRepository } from "./testing/in-memory-notebook-repository";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const NOW = new Date("2026-09-23T12:00:00.000Z");
const OWNER_ID = "3d2f9a1e-5b6c-4d7e-8f90-1a2b3c4d5e6f";
const OTHER_OWNER_ID = "0a1b2c3d-4e5f-4061-8798-a1b2c3d4e5f6";

function makeDeps() {
  return {
    notebooks: new InMemoryNotebookRepository(),
    pages: new InMemoryPageRepository(),
    clock: createFixedClock(NOW),
  };
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

// Home shows only real data, never invented metrics (odd/tasks/
// app-shell-restyle.md, Product decision 1): every field here is derived
// from the owner's actual active notebooks and pages.
describe("getHomeOverview use case", () => {
  it("returns all-zero counts and empty lists for a fresh owner", async () => {
    const deps = makeDeps();

    const overview = await getHomeOverview(deps, OWNER_ID);

    expect(overview).toEqual({
      notebookCount: 0,
      pageCount: 0,
      pagesEditedThisWeek: 0,
      lastActivityAt: null,
      notebooks: [],
      recentPages: [],
    });
  });

  it("counts only the owner's active notebooks and pages, excluding archived ones and other owners'", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Biología" },
      deps,
      OWNER_ID,
    );
    const archivedNotebook = await createNotebook(
      { title: "Viejo" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok || !archivedNotebook.ok) throw new Error("setup failed");
    await deps.notebooks.update({
      ...archivedNotebook.value,
      archivedAt: NOW,
    });

    const page = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    if (!page.ok) throw new Error("setup failed");

    const otherNotebook = await createNotebook(
      { title: "De otro" },
      deps,
      OTHER_OWNER_ID,
    );
    if (!otherNotebook.ok) throw new Error("setup failed");
    await createPage(
      { notebookId: otherNotebook.value.id },
      deps,
      OTHER_OWNER_ID,
    );

    const overview = await getHomeOverview(deps, OWNER_ID);

    expect(overview.notebookCount).toBe(1);
    expect(overview.pageCount).toBe(1);
    expect(overview.notebooks).toHaveLength(1);
    expect(overview.notebooks[0]?.id).toBe(notebook.value.id);
  });

  it("counts pages edited within the last 7 days, not older ones", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook({ title: "Cálculo" }, deps, OWNER_ID);
    if (!notebook.ok) throw new Error("setup failed");
    const recent = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    const old = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    if (!recent.ok || !old.ok) throw new Error("setup failed");
    await deps.pages.update({ ...recent.value, updatedAt: daysAgo(2) });
    await deps.pages.update({ ...old.value, updatedAt: daysAgo(10) });

    const overview = await getHomeOverview(deps, OWNER_ID);

    expect(overview.pagesEditedThisWeek).toBe(1);
  });

  it("reports the most recent updatedAt across notebooks and pages as lastActivityAt", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook({ title: "Química" }, deps, OWNER_ID);
    if (!notebook.ok) throw new Error("setup failed");
    await deps.notebooks.update({ ...notebook.value, updatedAt: daysAgo(5) });
    const page = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    if (!page.ok) throw new Error("setup failed");
    const latest = daysAgo(1);
    await deps.pages.update({ ...page.value, updatedAt: latest });

    const overview = await getHomeOverview(deps, OWNER_ID);

    expect(overview.lastActivityAt).toEqual(latest);
  });

  it("summarizes each notebook with its page count and most recent activity, newest first", async () => {
    const deps = makeDeps();
    const older = await createNotebook({ title: "Historia" }, deps, OWNER_ID);
    const newer = await createNotebook({ title: "Física" }, deps, OWNER_ID);
    if (!older.ok || !newer.ok) throw new Error("setup failed");
    await deps.notebooks.update({ ...older.value, updatedAt: daysAgo(10) });
    await deps.notebooks.update({ ...newer.value, updatedAt: daysAgo(10) });
    const page = await createPage(
      { notebookId: newer.value.id },
      deps,
      OWNER_ID,
    );
    if (!page.ok) throw new Error("setup failed");
    await deps.pages.update({ ...page.value, updatedAt: daysAgo(1) });

    const overview = await getHomeOverview(deps, OWNER_ID);

    expect(overview.notebooks.map((n) => n.id)).toEqual([
      newer.value.id,
      older.value.id,
    ]);
    expect(overview.notebooks[0]?.pageCount).toBe(1);
    expect(overview.notebooks[0]?.updatedAt).toEqual(daysAgo(1));
    expect(overview.notebooks[1]?.pageCount).toBe(0);
  });

  it("returns at most the 5 most recently updated pages, newest first, with their notebook's title", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Biología" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");
    const pages = [];
    for (let i = 0; i < 6; i++) {
      const created = await createPage(
        { notebookId: notebook.value.id, title: `Página ${i}` },
        deps,
        OWNER_ID,
      );
      if (!created.ok) throw new Error("setup failed");
      await deps.pages.update({ ...created.value, updatedAt: daysAgo(i) });
      pages.push(created.value);
    }

    const overview = await getHomeOverview(deps, OWNER_ID);

    expect(overview.recentPages).toHaveLength(5);
    expect(overview.recentPages[0]?.id).toBe(pages[0]?.id);
    expect(overview.recentPages[0]?.notebookTitle).toBe("Biología");
    expect(overview.recentPages.map((p) => p.id)).not.toContain(pages[5]?.id);
  });
});
