import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const actions = vi.hoisted(() => ({
  deleteNotebook: vi.fn(),
  deletePage: vi.fn(),
  previewNotebookDeletion: vi.fn(),
  previewPageDeletion: vi.fn(),
}));
vi.mock("../actions", () => actions);

import { DeletePageButton } from "./delete-content-dialogs";

const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";

function setup() {
  const user = userEvent.setup();
  const followed = vi.fn((event: Event) => event.preventDefault());
  render(
    // The button sits inside the page card's link (notebook route).
    <a href="/notebooks/nb/pages/p" onClick={(e) => followed(e.nativeEvent)}>
      Mitocondria
      <DeletePageButton pageId={PAGE} title="Mitocondria" />
    </a>,
  );
  return { user, followed };
}

// Phase 8 H19 (V10 coverage): the page card's trash button.
describe("DeletePageButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    for (const action of Object.values(actions)) action.mockReset();
    actions.previewPageDeletion.mockResolvedValue({
      ok: true,
      value: { flashcards: 3, recallQuestions: 0, examQuestions: 0, images: 1 },
    });
  });

  it("opens the confirmation with the server's counts, never following the card link", async () => {
    const { user, followed } = setup();

    await user.click(
      screen.getByRole("button", { name: "Eliminar página Mitocondria" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "¿Eliminar la página «Mitocondria»?",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/3 tarjetas/)).toBeInTheDocument();
    expect(actions.previewPageDeletion).toHaveBeenCalledWith({ pageId: PAGE });
    expect(followed).not.toHaveBeenCalled();
  });

  it("deletes the page and refreshes the route once confirmed", async () => {
    actions.deletePage.mockResolvedValue({ ok: true, value: undefined });
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Eliminar página Mitocondria" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Eliminar página" }),
    );

    expect(actions.deletePage).toHaveBeenCalledWith({ pageId: PAGE });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says why when the page is already gone, keeping the route as it is", async () => {
    actions.deletePage.mockResolvedValue({
      ok: false,
      error: { code: "PAGE_NOT_FOUND", message: "x" },
    });
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Eliminar página Mitocondria" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Eliminar página" }),
    );

    expect(
      await screen.findByText("Esta página ya no existe."),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
