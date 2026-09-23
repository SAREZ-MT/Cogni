import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateNotebookIconButton } from "./create-notebook-icon-button";

const { createNotebook } = vi.hoisted(() => ({
  createNotebook: vi.fn(),
}));
vi.mock("../actions", () => ({
  createNotebook,
}));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// S1 (sidebar.tsx collapsed column): the compact trigger must open the same
// "Crear cuaderno" dialog and mutation the expanded SidebarTreeClient uses,
// behind an icon-only button so the tooltip carries the accessible name.
describe("CreateNotebookIconButton", () => {
  beforeEach(() => {
    createNotebook.mockReset();
    createNotebook.mockResolvedValue({ id: "notebook-1" });
  });

  it("renders an icon-only button named 'Crear cuaderno'", () => {
    render(<CreateNotebookIconButton />, { wrapper: Wrapper });

    const button = screen.getByRole("button", { name: "Crear cuaderno" });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveTextContent("Crear cuaderno");
  });

  it("shows the tooltip label on hover", async () => {
    const user = userEvent.setup();
    render(<CreateNotebookIconButton />, { wrapper: Wrapper });

    await user.hover(screen.getByRole("button", { name: "Crear cuaderno" }));

    await waitFor(() => {
      expect(screen.getAllByText("Crear cuaderno").length).toBeGreaterThan(0);
    });
  });

  it("opens the same create-notebook dialog and submits the mutation", async () => {
    const user = userEvent.setup();
    render(<CreateNotebookIconButton />, { wrapper: Wrapper });

    await user.click(screen.getByRole("button", { name: "Crear cuaderno" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Título"), "Álgebra lineal");
    await user.click(
      within(dialog).getByRole("button", { name: "Crear cuaderno" }),
    );

    await waitFor(() => {
      expect(createNotebook).toHaveBeenCalledWith({ title: "Álgebra lineal" });
    });
  });
});
