import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
// The import flow's own Server Actions never run here: the test stops at
// the file picker.
vi.mock("@/modules/ingestion/actions", () => ({
  requestPdfUpload: vi.fn(),
  startPdfImport: vi.fn(),
}));

import { DocumentImportProvider } from "@/modules/ingestion/ui/document-import-provider";
import { NewPageDialog } from "./new-page-dialog";

function renderDialog(createBlankPage = vi.fn(async () => {})) {
  render(
    <DocumentImportProvider>
      <NewPageDialog
        notebookId="nb1"
        createBlankPage={createBlankPage}
        trigger={<button type="button">Nueva página</button>}
      />
    </DocumentImportProvider>,
  );
  return { createBlankPage };
}

// Phase 8 H5-T3 (user 2026-10-29): every "Nueva página" opens a dialog that
// asks how to create the page: blank (opens the editor) or by importing a
// PDF, Word or PowerPoint document through the existing import flow.
describe("NewPageDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens from its trigger with both options and the three formats", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Nueva página" }));

    const dialog = screen.getByRole("dialog", { name: "Nueva página" });
    expect(dialog).toHaveTextContent("Elige cómo quieres empezar");
    expect(
      screen.getByRole("button", { name: /Página en blanco/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Importar un documento/ }),
    ).toBeInTheDocument();
    for (const format of ["PDF", "DOCX", "PPTX"]) {
      expect(screen.getByText(format)).toBeInTheDocument();
    }
  });

  it("creates a blank page through the route's action", async () => {
    const user = userEvent.setup();
    const { createBlankPage } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    await user.click(screen.getByRole("button", { name: /Página en blanco/ }));

    expect(createBlankPage).toHaveBeenCalledTimes(1);
  });

  it("opens the existing import picker, limited to PDF, DOCX and PPTX, and closes", async () => {
    const user = userEvent.setup();
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    await user.click(
      screen.getByRole("button", { name: /Importar un documento/ }),
    );

    const input = screen.getByTestId("document-import-input");
    expect(click).toHaveBeenCalled();
    expect(click.mock.contexts.at(-1)).toBe(input);
    const accept = input.getAttribute("accept") ?? "";
    for (const extension of [".pdf", ".docx", ".pptx"]) {
      expect(accept).toContain(extension);
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Nueva página" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
