import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PagePicker, type PagePickerNotebook } from "./page-picker";
import { chooseOption } from "./select.testing";

const NOTEBOOKS: PagePickerNotebook[] = [
  {
    id: "nb-bio",
    title: "Biología",
    pages: [
      { id: "p-1", title: "Tema 1" },
      { id: "p-2", title: "Tema 2" },
    ],
  },
  { id: "nb-empty", title: "Vacío", pages: [] },
];

function renderPicker(
  props: Partial<React.ComponentProps<typeof PagePicker>> = {},
) {
  const onNotebookChange = vi.fn();
  const onPageChange = vi.fn();
  render(
    <PagePicker
      notebooks={NOTEBOOKS}
      notebookId="nb-bio"
      pageId=""
      onNotebookChange={onNotebookChange}
      onPageChange={onPageChange}
      testIdPrefix="pick"
      {...props}
    />,
  );
  return { onNotebookChange, onPageChange };
}

// Phase 8 H11: the notebook-then-page picker shared by "Crear examen" and
// the flashcards / active recall create dialogs (all content belongs to a
// page).
describe("PagePicker", () => {
  it("picks a notebook, then a page of that notebook, with styled selects", async () => {
    const user = userEvent.setup();
    const { onNotebookChange, onPageChange } = renderPicker();

    const notebook = screen.getByRole("combobox", { name: "Cuaderno" });
    expect(notebook).toHaveTextContent("Biología");
    const page = screen.getByRole("combobox", { name: "Página" });
    expect(page).toHaveTextContent("Elige una página");
    // Phase 8 H12: the Select atom, not a native <select>.
    expect(page.tagName).toBe("BUTTON");
    expect(page).toHaveAttribute("data-slot", "select-trigger");

    page.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Tema 1", "Tema 2"]);
    await user.click(screen.getByRole("option", { name: "Tema 2" }));
    expect(onPageChange).toHaveBeenCalledWith("p-2");

    await chooseOption(user, notebook, "Vacío");
    expect(onNotebookChange).toHaveBeenCalledWith("nb-empty");
    expect(screen.getByTestId("pick-notebook")).toBeInTheDocument();
    expect(screen.getByTestId("pick-page")).toBeInTheDocument();
  });

  it("is operable from the keyboard alone", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderPicker();

    screen.getByRole("combobox", { name: "Página" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onPageChange).toHaveBeenCalledWith("p-2");
  });

  it("offers to create a notebook when there are none", () => {
    renderPicker({ notebooks: [], notebookId: "" });

    expect(
      screen.getByText("Aún no tienes cuadernos. Crea uno para empezar."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Crear un cuaderno" }),
    ).toHaveAttribute("href", "/notebooks");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers to create a page in a notebook without pages", () => {
    renderPicker({ notebookId: "nb-empty" });

    expect(
      screen.getByText("Este cuaderno aún no tiene páginas."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Crear una página" }),
    ).toHaveAttribute("href", "/notebooks/nb-empty");
    expect(
      screen.queryByRole("combobox", { name: "Página" }),
    ).not.toBeInTheDocument();
  });

  it("shows a load error instead of the empty state when the notebooks could not be read", () => {
    renderPicker({ notebooks: null, notebookId: "" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar tus cuadernos. Intenta de nuevo.",
    );
    expect(
      screen.queryByRole("link", { name: "Crear un cuaderno" }),
    ).not.toBeInTheDocument();
  });

  it("locks both selects while busy", () => {
    renderPicker({ disabled: true });

    expect(screen.getByRole("combobox", { name: "Cuaderno" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Página" })).toBeDisabled();
  });
});
