import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateNotebookTrigger } from "./create-notebook-trigger";

const { createNotebook } = vi.hoisted(() => ({ createNotebook: vi.fn() }));
vi.mock("../actions", () => ({ createNotebook }));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function submitDialog(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Título"), "Álgebra lineal");
  await user.click(
    within(dialog).getByRole("button", { name: "Crear cuaderno" }),
  );
}

// Home's "+ Nuevo cuaderno" pill CTA (home-header.tsx) and the dashed
// "Nuevo cuaderno" grid tile (notebook-grid.tsx) share this one trigger:
// the same CreateNotebookDialog and mutation SidebarTreeClient/
// CreateNotebookIconButton use, plus router.refresh() so a notebook
// created from Home refreshes Home's own server-rendered stats (S4 review
// follow-up: "refresh after creating a notebook").
describe("CreateNotebookTrigger", () => {
  beforeEach(() => {
    createNotebook.mockReset();
    createNotebook.mockResolvedValue({ id: "notebook-1" });
    refresh.mockReset();
  });

  it("renders the pill variant with the '+ Nuevo cuaderno' accessible name by default", () => {
    render(<CreateNotebookTrigger />, { wrapper: Wrapper });

    expect(
      screen.getByRole("button", { name: "Nuevo cuaderno" }),
    ).toBeInTheDocument();
  });

  it("renders the tile variant with a dashed 'Nuevo cuaderno' tile", () => {
    render(<CreateNotebookTrigger variant="tile" />, { wrapper: Wrapper });

    expect(
      screen.getByRole("button", { name: "Nuevo cuaderno" }),
    ).toBeInTheDocument();
  });

  it("submits the same createNotebook mutation both variants share", async () => {
    const user = userEvent.setup();
    render(<CreateNotebookTrigger variant="tile" />, { wrapper: Wrapper });

    await user.click(screen.getByRole("button", { name: "Nuevo cuaderno" }));
    await submitDialog(user);

    await waitFor(() => {
      expect(createNotebook).toHaveBeenCalledWith({ title: "Álgebra lineal" });
    });
  });

  it("refreshes the router after a successful create, so Home's server data updates", async () => {
    const user = userEvent.setup();
    render(<CreateNotebookTrigger />, { wrapper: Wrapper });

    await user.click(screen.getByRole("button", { name: "Nuevo cuaderno" }));
    await submitDialog(user);

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("surfaces a mutation error instead of failing silently", async () => {
    const user = userEvent.setup();
    createNotebook.mockRejectedValue(new Error("network down"));
    render(<CreateNotebookTrigger />, { wrapper: Wrapper });

    await user.click(screen.getByRole("button", { name: "Nuevo cuaderno" }));
    await submitDialog(user);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No se pudo crear el cuaderno. Intenta de nuevo.",
      );
    });
  });
});
