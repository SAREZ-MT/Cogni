import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_STATUS_SLOT_ID,
  PageHeader,
} from "../../../../_components/page-header";

// T11, design.md "Decision: Vista de página, llamada en curso y polling con
// TanStack Query": this route now fetches the job status on the server and
// hands it to PageImportView as `initial`. Same mocking rationale as
// max-duration.test.ts: `server-only` is stubbed, heavy modules are mocked,
// and the page component is called directly (never rendered) so this stays
// a fast unit test with no DOM/Server Action wiring for PageImportView
// itself (that behavior is covered by page-import-view.test.tsx).
//
// E1 (editor pass, goal doc §1/§2): PageHeader no longer takes a plain
// `title` string — it takes a `titleSlot`, and the route now renders that
// slot as `<PageTitle>` (the client wrapper that owns PageTitleEditor +
// breadcrumb publishing) and the editor mount as `<PageEditor>` (the client
// wrapper that injects the mention port / "Importar PDF" slash item).
// Both are mocked wholesale here, same as `Editor` used to be — their own
// internals (which pull in Server Actions, `usePdfImport`, etc.) are never
// executed by this non-rendering, server-component-only test, and are
// covered by their own behavior elsewhere (page-title-editor.test.tsx-style
// coverage is a known gap noted in the E1 report, not added in this pass).
vi.mock("server-only", () => ({}));

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

const { designPreviewsEnabled } = vi.hoisted(() => ({
  designPreviewsEnabled: vi.fn(() => true),
}));
vi.mock("@/shared/config/design-previews", () => ({ designPreviewsEnabled }));

const { TechniquesPanel } = vi.hoisted(() => ({
  TechniquesPanel: vi.fn(() => null),
}));
vi.mock("./_components/techniques-panel", () => ({ TechniquesPanel }));

const { listFlashcardsAction, getGenerationStatusAction } = vi.hoisted(() => ({
  listFlashcardsAction: vi.fn(),
  getGenerationStatusAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({
  listFlashcardsAction,
  getGenerationStatusAction,
}));

const { PageEditor } = vi.hoisted(() => ({ PageEditor: vi.fn(() => null) }));
vi.mock("./_components/page-editor", () => ({ PageEditor }));

const { PageTitle } = vi.hoisted(() => ({ PageTitle: vi.fn(() => null) }));
vi.mock("./_components/page-title", () => ({ PageTitle }));

const { getPageForRoute, getNotebookTitleForRoute } = vi.hoisted(() => ({
  getPageForRoute: vi.fn(),
  getNotebookTitleForRoute: vi.fn(),
}));
vi.mock("@/modules/notebooks", () => ({
  getAssetReadUrl: vi.fn(),
  getCurrentContent: vi.fn(),
  getPageForRoute,
  getNotebookTitleForRoute,
  registerPageAsset: vi.fn(),
  requestImageUpload: vi.fn(),
  saveContent: vi.fn(),
}));

const { getImportJobStatus, PageImportView } = vi.hoisted(() => ({
  getImportJobStatus: vi.fn(),
  PageImportView: vi.fn(() => null),
}));
vi.mock("@/modules/ingestion", () => ({ getImportJobStatus, PageImportView }));

function page() {
  return {
    id: "page-1",
    title: "Apuntes",
    content: { type: "doc", content: [] },
    contentVersion: 3,
    updatedAt: new Date("2026-09-23T10:00:00.000Z"),
  };
}

// The route returns a fragment: [content section, techniques panel | false].
async function renderFragment() {
  const { default: PageView } = await import("./page");
  const fragment = (await PageView({
    params: Promise.resolve({ notebookId: "nb-1", pageId: "page-1" }),
  })) as ReactElement<{ children: [ReactElement, ReactElement | false] }>;
  return fragment.props.children;
}

async function renderSection() {
  const [section] = await renderFragment();
  return section;
}

async function renderRoute() {
  const section = (await renderSection()) as ReactElement<{
    children: ReactElement[];
  }>;
  // Section children are now [BackLink, PageHeader, PageImportView] — a
  // BackLink to the notebook was added as the first child (user feedback:
  // no way back from the editor except the sidebar).
  const children = section.props.children;
  const importView = children[2] as ReactElement<{
    initial: unknown;
    pageId: string;
    editor: unknown;
  }>;
  return importView.props;
}

describe("page route ingestion wiring", () => {
  beforeEach(() => {
    cookieGet.mockReset();
    designPreviewsEnabled.mockReset();
    designPreviewsEnabled.mockReturnValue(true);
    getNotebookTitleForRoute.mockReset();
    getNotebookTitleForRoute.mockResolvedValue("Biología Celular");
    listFlashcardsAction.mockReset();
    listFlashcardsAction.mockResolvedValue({ ok: true, value: [] });
    getGenerationStatusAction.mockReset();
    getGenerationStatusAction.mockResolvedValue({
      ok: true,
      value: { remainingToday: 6, resetAt: "2026-10-05T00:00:00.000Z" },
    });
  });

  it("constrains the title and the editor to the design system reading measure (max-w-2xl, centered)", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });
    const section = (await renderSection()) as ReactElement<{
      className: string;
    }>;
    expect(section.props.className).toContain("max-w-2xl");
    expect(section.props.className).toContain("mx-auto");
  });

  it("fetches the job status by page id and passes it as PageImportView's initial prop", async () => {
    getPageForRoute.mockResolvedValue(page());
    const view = {
      importJobId: "job-1",
      pageId: "page-1",
      status: "processing",
      pageCount: null,
      pagesWithoutText: 0,
      error: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    getImportJobStatus.mockResolvedValue({ ok: true, value: view });

    const props = await renderRoute();

    expect(getImportJobStatus).toHaveBeenCalledWith({ pageId: "page-1" });
    expect(props.pageId).toBe("page-1");
    expect(props.initial).toEqual(view);
  });

  it("degrades to a null initial job when getImportJobStatus fails, without throwing", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({
      ok: false,
      error: { code: "INGESTION_UNEXPECTED", message: "boom" },
    });

    const props = await renderRoute();

    expect(props.initial).toBeNull();
  });

  // F5a (odd/tasks/review-followups.md): when the notebook lookup yields
  // nothing (archived/foreign notebook, or a failed lookup) the old link
  // still pointed at `/notebooks/{id}`, a route that then renders not-found.
  it("links the back link to the notebook when its lookup succeeds", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });

    const section = (await renderSection()) as ReactElement<{
      children: ReactElement<{ href: string; children: string }>[];
    }>;
    const back = section.props.children[0];

    expect(back.props.href).toBe("/notebooks/nb-1");
    expect(back.props.children).toBe("Biología Celular");
  });

  it("falls back to the notebooks list when the notebook lookup yields nothing", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });
    getNotebookTitleForRoute.mockResolvedValue(null);

    const section = (await renderSection()) as ReactElement<{
      children: ReactElement<{ href: string; children: string }>[];
    }>;
    const back = section.props.children[0];

    expect(back.props.href).toBe("/notebooks");
    expect(back.props.children).toBe("Cuadernos");
  });

  // S5 (odd/tasks/app-shell-restyle.md), E1 (goal doc §1): the route renders
  // PageHeader with a `titleSlot` instead of a plain title string — the
  // real title editor/breadcrumb wiring lives in `<PageTitle>` (mocked
  // above), so this only asserts the route hands it the right data.
  // R3-002 (review follow-up folded into S6a): assert the element's actual
  // type, not only its props by position.
  it("renders PageHeader with a PageTitle slot carrying the page's title/notebook, and updatedAt", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });

    const section = (await renderSection()) as ReactElement<{
      children: ReactElement[];
    }>;

    // children[0] is now the BackLink to the notebook (user feedback: no
    // way back from the editor except the sidebar) — PageHeader shifted to
    // index 1.
    const header = section.props.children[1] as ReactElement<{
      titleSlot: ReactElement<{
        pageId: string;
        notebookId: string;
        initialTitle: string;
        notebookTitle: string | null;
      }>;
      updatedAt: Date;
    }>;

    expect(header.type).toBe(PageHeader);
    expect(header.props.titleSlot.type).toBe(PageTitle);
    expect(header.props.titleSlot.props).toEqual({
      pageId: "page-1",
      notebookId: "nb-1",
      initialTitle: "Apuntes",
      notebookTitle: "Biología Celular",
    });
    expect(header.props.updatedAt).toEqual(
      new Date("2026-09-23T10:00:00.000Z"),
    );
  });

  it("degrades PageTitle's notebookTitle to null when the notebook lookup fails", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });
    getNotebookTitleForRoute.mockResolvedValue(null);

    const section = (await renderSection()) as ReactElement<{
      children: ReactElement[];
    }>;

    const header = section.props.children[1] as ReactElement<{
      titleSlot: ReactElement<{ notebookTitle: string | null }>;
    }>;
    expect(header.props.titleSlot.props.notebookTitle).toBeNull();
  });

  it("passes the PageEditor mount as the editor prop", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });

    const props = await renderRoute();

    expect(props.editor).toBeDefined();
  });

  // S7 (odd/tasks/app-shell-restyle.md): the autosave status now portals
  // into a slot PageHeader renders in its meta row (screenshots/editor.png)
  // instead of sitting between the header and the first block. The route
  // wires both ends: PageHeader gets a statusSlot with the stable id, and
  // the PageEditor mount gets the matching statusPortalId.
  it("wires PageHeader's status slot id to the PageEditor's statusPortalId", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });

    const section = (await renderSection()) as ReactElement<{
      children: ReactElement[];
    }>;

    const header = section.props.children[1] as ReactElement<{
      statusSlot?: ReactElement<{ id?: string }>;
    }>;
    expect(header.props.statusSlot?.props.id).toBe(PAGE_STATUS_SLOT_ID);

    const importView = section.props.children[2] as ReactElement<{
      editor: ReactElement<{
        children: ReactElement<{ statusPortalId?: string }>;
      }>;
    }>;
    expect(importView.props.editor.props.children.props.statusPortalId).toBe(
      PAGE_STATUS_SLOT_ID,
    );
  });

  // E1 (goal doc §2, "Importar PDF"): the composition root wires the
  // current route's notebookId into PageEditor, which is what its own
  // extraSlashItems bridge (page-editor.tsx) closes over for `start({
  // notebookId })`.
  it("passes the route's notebookId to PageEditor", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });

    const section = (await renderSection()) as ReactElement<{
      children: ReactElement[];
    }>;

    const importView = section.props.children[2] as ReactElement<{
      editor: ReactElement<{
        children: ReactElement<{ notebookId?: string }>;
      }>;
    }>;
    expect(importView.props.editor.props.children.props.notebookId).toBe(
      "nb-1",
    );
  });

  // Flashcards are real since Phase 3, so the panel always renders; the
  // server decides only whether the still-sample techniques (Active recall,
  // Exámenes) appear in it, via `showPreviews`.
  describe("techniques panel", () => {
    beforeEach(() => {
      getPageForRoute.mockResolvedValue(page());
      getImportJobStatus.mockResolvedValue({ ok: true, value: null });
    });

    type PanelProps = {
      showPreviews: boolean;
      notebookId: string;
      pageId: string;
      initialFlashcards: unknown[];
      initialRemaining: number | null;
    };

    async function renderPanelProps() {
      const [, panel] = await renderFragment();
      expect((panel as ReactElement).type).toBe(TechniquesPanel);
      return (panel as ReactElement<PanelProps>).props;
    }

    it("renders the panel with previews on, passing the page identity", async () => {
      designPreviewsEnabled.mockReturnValue(true);

      const props = await renderPanelProps();

      expect(props.showPreviews).toBe(true);
      expect(props.notebookId).toBe("nb-1");
      expect(props.pageId).toBe("page-1");
    });

    it("still renders the panel with previews off, flagged as no previews", async () => {
      designPreviewsEnabled.mockReturnValue(false);

      const [section, panel] = await renderFragment();

      expect((panel as ReactElement).type).toBe(TechniquesPanel);
      expect((panel as ReactElement<PanelProps>).props.showPreviews).toBe(
        false,
      );
      expect((section.props as { className: string }).className).toContain(
        "max-w-2xl",
      );
    });

    it("loads the page's cards and the remaining generations on the server", async () => {
      const cards = [
        { id: "c1", pageId: "page-1", front: "P", back: "R", position: 0 },
      ];
      listFlashcardsAction.mockResolvedValue({ ok: true, value: cards });
      getGenerationStatusAction.mockResolvedValue({
        ok: true,
        value: { remainingToday: 2, resetAt: "2026-10-05T00:00:00.000Z" },
      });

      const props = await renderPanelProps();

      expect(listFlashcardsAction).toHaveBeenCalledWith({ pageId: "page-1" });
      expect(props.initialFlashcards).toEqual(cards);
      expect(props.initialRemaining).toBe(2);
    });

    it("degrades to no cards and an unknown counter when the actions fail", async () => {
      listFlashcardsAction.mockResolvedValue({
        ok: false,
        error: { code: "FLASHCARDS_UNEXPECTED", message: "x" },
      });
      getGenerationStatusAction.mockRejectedValue(new Error("boom"));

      const props = await renderPanelProps();

      expect(props.initialFlashcards).toEqual([]);
      expect(props.initialRemaining).toBeNull();
    });

    it("starts the panel collapsed when the visitor's cookie says so", async () => {
      cookieGet.mockReturnValue({ value: "collapsed" });

      const [, panel] = await renderFragment();

      expect(
        (panel as ReactElement<{ initialCollapsed: boolean }>).props
          .initialCollapsed,
      ).toBe(true);
    });

    it("starts the panel expanded without a cookie", async () => {
      cookieGet.mockReturnValue(undefined);

      const [, panel] = await renderFragment();

      expect(
        (panel as ReactElement<{ initialCollapsed: boolean }>).props
          .initialCollapsed,
      ).toBe(false);
    });
  });
});
