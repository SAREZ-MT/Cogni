import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageHeader } from "../../../../_components/page-header";

// T11, design.md "Decision: Vista de página, llamada en curso y polling con
// TanStack Query": this route now fetches the job status on the server and
// hands it to PageImportView as `initial`. Same mocking rationale as
// max-duration.test.ts: `server-only` is stubbed, heavy modules are mocked,
// and the page component is called directly (never rendered) so this stays
// a fast unit test with no DOM/Server Action wiring for PageImportView
// itself (that behavior is covered by page-import-view.test.tsx).
vi.mock("server-only", () => ({}));
vi.mock("@/modules/editor", () => ({ Editor: () => null }));

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

async function renderRoute() {
  const { default: PageView } = await import("./page");
  const section = (await PageView({
    params: Promise.resolve({ notebookId: "nb-1", pageId: "page-1" }),
  })) as ReactElement<{ children: ReactElement[] }>;
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
    getNotebookTitleForRoute.mockReset();
    getNotebookTitleForRoute.mockResolvedValue("Biología Celular");
  });

  it("constrains the title and the editor to the design system reading measure (max-w-2xl, centered)", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });
    const { default: PageView } = await import("./page");
    const section = (await PageView({
      params: Promise.resolve({ notebookId: "nb-1", pageId: "page-1" }),
    })) as ReactElement<{ className: string }>;
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

  // S5 (odd/tasks/app-shell-restyle.md): the route renders PageHeader
  // instead of a bare <h1>, passing the page's own title and updatedAt for
  // the meta row's last-edit item. R3-002 (review follow-up folded into
  // S6a): assert the element's actual type, not only its props by
  // position — a future reorder of `section`'s children would otherwise
  // silently start asserting props against the wrong element.
  it("renders PageHeader with the page's title and updatedAt", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });

    const { default: PageView } = await import("./page");
    const section = (await PageView({
      params: Promise.resolve({ notebookId: "nb-1", pageId: "page-1" }),
    })) as ReactElement<{ children: ReactElement[] }>;

    const header = section.props.children[1] as ReactElement<{
      title: string;
      updatedAt: Date;
    }>;

    expect(header.type).toBe(PageHeader);
    expect(header.props.title).toBe("Apuntes");
    expect(header.props.updatedAt).toEqual(
      new Date("2026-09-23T10:00:00.000Z"),
    );
  });

  it("passes the Editor mount as the editor prop", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });

    const props = await renderRoute();

    expect(props.editor).toBeDefined();
  });

  // S3 breadcrumb: "Cogni › {cuaderno} › {página}" — the notebook title is
  // read server-side via getNotebookTitleForRoute so SetBreadcrumb can
  // publish both segments.
  it("publishes '{cuaderno} › {página}' as the breadcrumb trail", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });
    getNotebookTitleForRoute.mockResolvedValue("Biología Celular");

    const { default: PageView } = await import("./page");
    const section = (await PageView({
      params: Promise.resolve({ notebookId: "nb-1", pageId: "page-1" }),
    })) as ReactElement<{ children: ReactElement[] }>;

    const setBreadcrumb = section.props.children[0] as ReactElement<{
      items: { label: string }[];
    }>;

    expect(getNotebookTitleForRoute).toHaveBeenCalledWith("nb-1");
    expect(setBreadcrumb.props.items).toEqual([
      { label: "Biología Celular" },
      { label: "Apuntes" },
    ]);
  });

  it("degrades to just the page title when the notebook lookup fails", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });
    getNotebookTitleForRoute.mockResolvedValue(null);

    const { default: PageView } = await import("./page");
    const section = (await PageView({
      params: Promise.resolve({ notebookId: "nb-1", pageId: "page-1" }),
    })) as ReactElement<{ children: ReactElement[] }>;

    const setBreadcrumb = section.props.children[0] as ReactElement<{
      items: { label: string }[];
    }>;

    expect(setBreadcrumb.props.items).toEqual([{ label: "Apuntes" }]);
  });
});
