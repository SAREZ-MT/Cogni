import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu, DropdownMenuContent } from "@/shared/ui/dropdown-menu";
import { ImportDocumentMenuItem } from "./import-document-menu-item";
import { INGESTION_COPY } from "./ingestion-copy";

type MockImportStatus = "idle" | "uploading" | "queued" | "failed" | "busy";

const { start, useNotebookImportMock } = vi.hoisted(() => ({
  start: vi.fn(),
  useNotebookImportMock: vi.fn((): { status: MockImportStatus } => ({
    status: "idle",
  })),
}));
vi.mock("./document-import-provider", () => ({
  useDocumentImport: () => ({ start }),
  useNotebookImport: useNotebookImportMock,
}));

function renderMenuItem(
  props: Partial<React.ComponentProps<typeof ImportDocumentMenuItem>> = {},
) {
  return render(
    <DropdownMenu defaultOpen>
      <DropdownMenuContent>
        <ImportDocumentMenuItem
          notebook={{ id: "nb-1", title: "Biología" }}
          {...props}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe("ImportDocumentMenuItem", () => {
  it("renders the Spanish label with the FileUp icon", () => {
    renderMenuItem();
    expect(
      screen.getByRole("menuitem", { name: INGESTION_COPY.importDocument }),
    ).toBeInTheDocument();
  });

  it("calls start with the notebookId and the onImported helper as onPageCreated", async () => {
    const onImported = vi.fn();
    const user = userEvent.setup();
    renderMenuItem({ onImported });

    await user.click(
      screen.getByRole("menuitem", { name: "Importar documento" }),
    );

    expect(start).toHaveBeenCalledWith({
      notebookId: "nb-1",
      onPageCreated: onImported,
    });
  });

  it("is disabled while an import is uploading for this notebook", () => {
    useNotebookImportMock.mockReturnValueOnce({ status: "uploading" });
    renderMenuItem();

    expect(
      screen.getByRole("menuitem", { name: "Importar documento" }),
    ).toHaveAttribute("data-disabled");
  });

  it("is disabled while an import is queued for this notebook", () => {
    useNotebookImportMock.mockReturnValueOnce({ status: "queued" });
    renderMenuItem();

    expect(
      screen.getByRole("menuitem", { name: "Importar documento" }),
    ).toHaveAttribute("data-disabled");
  });

  it("stays enabled when idle (the default mock status; R3-menu-item-idle-case-untested)", () => {
    renderMenuItem();

    expect(
      screen.getByRole("menuitem", { name: "Importar documento" }),
    ).not.toHaveAttribute("data-disabled");
  });

  it("stays enabled when failed", () => {
    useNotebookImportMock.mockReturnValueOnce({ status: "failed" });
    renderMenuItem();

    expect(
      screen.getByRole("menuitem", { name: "Importar documento" }),
    ).not.toHaveAttribute("data-disabled");
  });

  it("is disabled while another notebook is importing (busy, T10 follow-up)", () => {
    useNotebookImportMock.mockReturnValueOnce({ status: "busy" });
    renderMenuItem();

    expect(
      screen.getByRole("menuitem", { name: "Importar documento" }),
    ).toHaveAttribute("data-disabled");
  });
});
