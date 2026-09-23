import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

// T11, design.md "Decision: Vista de página, llamada en curso y polling con
// TanStack Query": this route now fetches the job status on the server and
// hands it to PageImportView as `initial`. Same mocking rationale as
// max-duration.test.ts: `server-only` is stubbed, heavy modules are mocked,
// and the page component is called directly (never rendered) so this stays
// a fast unit test with no DOM/Server Action wiring for PageImportView
// itself (that behavior is covered by page-import-view.test.tsx).
vi.mock("server-only", () => ({}));
vi.mock("@/modules/editor", () => ({ Editor: () => null }));

const { getPageForRoute } = vi.hoisted(() => ({ getPageForRoute: vi.fn() }));
vi.mock("@/modules/notebooks", () => ({
  getAssetReadUrl: vi.fn(),
  getCurrentContent: vi.fn(),
  getPageForRoute,
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
  };
}

async function renderRoute() {
  const { default: PageView } = await import("./page");
  const section = (await PageView({
    params: Promise.resolve({ notebookId: "nb-1", pageId: "page-1" }),
  })) as ReactElement<{ children: ReactElement[] }>;
  const children = section.props.children;
  const importView = children[1] as ReactElement<{
    initial: unknown;
    pageId: string;
    editor: unknown;
  }>;
  return importView.props;
}

describe("page route ingestion wiring", () => {
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

  it("passes the Editor mount as the editor prop", async () => {
    getPageForRoute.mockResolvedValue(page());
    getImportJobStatus.mockResolvedValue({ ok: true, value: null });

    const props = await renderRoute();

    expect(props.editor).toBeDefined();
  });
});
