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

function words(count: number): string {
  return Array.from({ length: count }, (_, i) => `palabra${i}`).join(" ");
}

type Deps = ReturnType<typeof makeDeps>;

async function seedNotebook(deps: Deps, title = "Cuaderno") {
  const notebook = await createNotebook({ title }, deps, OWNER_ID);
  if (!notebook.ok) throw new Error("setup failed");
  return notebook.value;
}

// Creates a page in `notebookId` and stamps the fields the Home metrics read
// (plain text for the word count, updatedAt for recency and activity days).
async function seedPage(
  deps: Deps,
  notebookId: string,
  fields: { title?: string; plainText?: string; updatedAt: Date },
) {
  const page = await createPage(
    { notebookId, title: fields.title },
    deps,
    OWNER_ID,
  );
  if (!page.ok) throw new Error("setup failed");
  const updated = {
    ...page.value,
    plainText: fields.plainText ?? "",
    updatedAt: fields.updatedAt,
  };
  await deps.pages.update(updated);
  return updated;
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
      readyToReview: { items: [], totalReady: 0, totalRich: 0 },
      streak: { activeDays: 0, days: Array(14).fill(false) },
      weeklyGoal: { activeDays: 0, days: Array(7).fill(false), goal: 5 },
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

  // R3-home-overview-archived-notebook-pages (S4 review follow-up):
  // archiveNotebook cascades the same instant to its active pages, but this
  // defends against a page that stays active under a notebook archived by
  // some other path (data inconsistency) — it must never leak into counts,
  // lastActivityAt or recentPages with an empty notebookTitle.
  it("excludes a page whose notebook is archived, even if the page itself is still active", async () => {
    const deps = makeDeps();
    const notebook = await createNotebook(
      { title: "Notas viejas" },
      deps,
      OWNER_ID,
    );
    if (!notebook.ok) throw new Error("setup failed");
    const page = await createPage(
      { notebookId: notebook.value.id },
      deps,
      OWNER_ID,
    );
    if (!page.ok) throw new Error("setup failed");
    await deps.pages.update({ ...page.value, updatedAt: NOW });
    // Archive the notebook directly (bypassing the archiveNotebook use
    // case's own cascade) so its page stays active — the inconsistent state
    // this defensive filter guards against.
    await deps.notebooks.update({ ...notebook.value, archivedAt: NOW });

    const overview = await getHomeOverview(deps, OWNER_ID);

    expect(overview.pageCount).toBe(0);
    expect(overview.pagesEditedThisWeek).toBe(0);
    expect(overview.lastActivityAt).toBeNull();
    expect(overview.recentPages).toHaveLength(0);
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

  describe("recent pages carry their notebook's color", () => {
    it("copies the notebook color onto each recent page (design pass 2: colored dot per notebook)", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await deps.notebooks.update({ ...notebook, color: "mint" });
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(1) });

      const overview = await getHomeOverview(deps, OWNER_ID);

      expect(overview.recentPages[0]?.notebookColor).toBe("mint");
    });

    it("reports null when the notebook has no color set (legacy rows render a neutral dot)", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await deps.notebooks.update({ ...notebook, color: null });
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(1) });

      const overview = await getHomeOverview(deps, OWNER_ID);

      expect(overview.recentPages[0]?.notebookColor).toBeNull();
    });
  });

  describe("readyToReview (>= 150 words and >= 3 days since the last edit)", () => {
    it("counts a page that clears both thresholds exactly, and lists it with its notebook color", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await deps.notebooks.update({ ...notebook, color: "purple" });
      const page = await seedPage(deps, notebook.id, {
        plainText: words(150),
        updatedAt: daysAgo(3),
      });

      const { readyToReview } = await getHomeOverview(deps, OWNER_ID);

      expect(readyToReview.totalReady).toBe(1);
      expect(readyToReview.totalRich).toBe(1);
      expect(readyToReview.items.map((item) => item.id)).toEqual([page.id]);
      expect(readyToReview.items[0]?.notebookColor).toBe("purple");
    });

    it("excludes a page under 150 words from both the ready count and the rich total", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await seedPage(deps, notebook.id, {
        plainText: words(149),
        updatedAt: daysAgo(10),
      });

      const { readyToReview } = await getHomeOverview(deps, OWNER_ID);

      expect(readyToReview).toEqual({ items: [], totalReady: 0, totalRich: 0 });
    });

    it("keeps a rich page edited less than 3 days ago out of the ready count but inside the rich total", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await seedPage(deps, notebook.id, {
        plainText: words(400),
        updatedAt: daysAgo(2),
      });

      const { readyToReview } = await getHomeOverview(deps, OWNER_ID);

      expect(readyToReview.totalReady).toBe(0);
      expect(readyToReview.totalRich).toBe(1);
      expect(readyToReview.items).toEqual([]);
    });

    it("ignores whitespace-only text when counting words", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await seedPage(deps, notebook.id, {
        plainText: "   \n\t  ",
        updatedAt: daysAgo(10),
      });

      const { readyToReview } = await getHomeOverview(deps, OWNER_ID);

      expect(readyToReview.totalRich).toBe(0);
    });

    it("lists only the 3 most urgent pages (older and richer first) but counts every ready page", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      const oldest = await seedPage(deps, notebook.id, {
        title: "Más antigua",
        plainText: words(200),
        updatedAt: daysAgo(20),
      });
      const middle = await seedPage(deps, notebook.id, {
        title: "Intermedia",
        plainText: words(200),
        updatedAt: daysAgo(10),
      });
      const fresh = await seedPage(deps, notebook.id, {
        title: "Reciente",
        plainText: words(200),
        updatedAt: daysAgo(5),
      });
      await seedPage(deps, notebook.id, {
        title: "Apenas lista",
        plainText: words(200),
        updatedAt: daysAgo(3),
      });

      const { readyToReview } = await getHomeOverview(deps, OWNER_ID);

      expect(readyToReview.totalReady).toBe(4);
      expect(readyToReview.items.map((item) => item.id)).toEqual([
        oldest.id,
        middle.id,
        fresh.id,
      ]);
    });

    it("breaks age ties in favor of the richer note", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      const shorter = await seedPage(deps, notebook.id, {
        plainText: words(150),
        updatedAt: daysAgo(6),
      });
      const longer = await seedPage(deps, notebook.id, {
        plainText: words(900),
        updatedAt: daysAgo(6),
      });

      const { readyToReview } = await getHomeOverview(deps, OWNER_ID);

      expect(readyToReview.items.map((item) => item.id)).toEqual([
        longer.id,
        shorter.id,
      ]);
    });
  });

  describe("streak (14-day window) and weeklyGoal (7-day window)", () => {
    it("marks today as the last day and counts each active calendar day once", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(0) });
      // Two pages edited on the same day still make a single active day.
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(2) });
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(2) });

      const { streak } = await getHomeOverview(deps, OWNER_ID);

      expect(streak.activeDays).toBe(2);
      expect(streak.days).toHaveLength(14);
      expect(streak.days[13]).toBe(true);
      expect(streak.days[11]).toBe(true);
      expect(streak.days[12]).toBe(false);
    });

    it("includes activity 13 days ago and drops activity 14 days ago from the streak", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(13) });
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(14) });

      const { streak } = await getHomeOverview(deps, OWNER_ID);

      expect(streak.activeDays).toBe(1);
      expect(streak.days[0]).toBe(true);
    });

    it("includes activity 6 days ago and drops activity 7 days ago from the weekly goal", async () => {
      const deps = makeDeps();
      const notebook = await seedNotebook(deps);
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(6) });
      await seedPage(deps, notebook.id, { updatedAt: daysAgo(7) });

      const { weeklyGoal } = await getHomeOverview(deps, OWNER_ID);

      expect(weeklyGoal.activeDays).toBe(1);
      expect(weeklyGoal.days).toHaveLength(7);
      expect(weeklyGoal.days[0]).toBe(true);
    });

    // F5c (odd/tasks/review-followups.md): the window used a raw timestamp
    // cut-off (now - 6 x 24 h) while the days are UTC calendar-day buckets,
    // so an edit on the window's first UTC day but earlier in the day than
    // `now` was dropped although its day is shown in `days`.
    describe("window edges are whole UTC days", () => {
      function depsAt(now: Date): Deps {
        return { ...makeDeps(), clock: createFixedClock(now) };
      }

      it("counts an edit earlier on the first day of the window than the current time of day", async () => {
        const deps = depsAt(new Date("2026-09-23T15:00:00.000Z"));
        const notebook = await seedNotebook(deps);
        await seedPage(deps, notebook.id, {
          updatedAt: new Date("2026-09-17T00:30:00.000Z"),
        });

        const { weeklyGoal, streak } = await getHomeOverview(deps, OWNER_ID);

        expect(weeklyGoal.days[0]).toBe(true);
        expect(weeklyGoal.activeDays).toBe(1);
        expect(streak.days[streak.days.length - 7]).toBe(true);
      });

      it("drops an edit on the last UTC day before the window, even a minute before midnight", async () => {
        const deps = depsAt(new Date("2026-09-23T15:00:00.000Z"));
        const notebook = await seedNotebook(deps);
        await seedPage(deps, notebook.id, {
          updatedAt: new Date("2026-09-16T23:59:00.000Z"),
        });

        const { weeklyGoal } = await getHomeOverview(deps, OWNER_ID);

        expect(weeklyGoal.activeDays).toBe(0);
        expect(weeklyGoal.days.every((day) => !day)).toBe(true);
      });

      it("keeps today's edit in the last day when it happened just after midnight UTC", async () => {
        const deps = depsAt(new Date("2026-09-23T00:10:00.000Z"));
        const notebook = await seedNotebook(deps);
        await seedPage(deps, notebook.id, {
          updatedAt: new Date("2026-09-23T00:05:00.000Z"),
        });

        const { weeklyGoal } = await getHomeOverview(deps, OWNER_ID);

        expect(weeklyGoal.days[6]).toBe(true);
        expect(weeklyGoal.activeDays).toBe(1);
      });
    });

    it("sets the weekly goal to 5 days", async () => {
      const deps = makeDeps();

      const { weeklyGoal } = await getHomeOverview(deps, OWNER_ID);

      expect(weeklyGoal.goal).toBe(5);
    });

    it("does not count activity from another owner's pages or archived notebooks", async () => {
      const deps = makeDeps();
      const archived = await seedNotebook(deps, "Archivado");
      await seedPage(deps, archived.id, { updatedAt: daysAgo(1) });
      await deps.notebooks.update({ ...archived, archivedAt: NOW });
      const other = await createNotebook(
        { title: "Ajeno" },
        deps,
        OTHER_OWNER_ID,
      );
      if (!other.ok) throw new Error("setup failed");
      const otherPage = await createPage(
        { notebookId: other.value.id },
        deps,
        OTHER_OWNER_ID,
      );
      if (!otherPage.ok) throw new Error("setup failed");
      await deps.pages.update({ ...otherPage.value, updatedAt: daysAgo(1) });

      const overview = await getHomeOverview(deps, OWNER_ID);

      expect(overview.streak.activeDays).toBe(0);
      expect(overview.weeklyGoal.activeDays).toBe(0);
    });
  });
});
