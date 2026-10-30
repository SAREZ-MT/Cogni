import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

const { archiveDeckAction, refresh } = vi.hoisted(() => ({
  archiveDeckAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({ archiveDeckAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DeleteDeckMenuItem, DeleteDeckProvider } from "./delete-deck";

function renderDeck() {
  render(
    <DeleteDeckProvider pageId="p1" deckTitle="Tema 1">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger>Acciones</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DeleteDeckMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </DeleteDeckProvider>,
  );
}

async function openConfirm() {
  renderDeck();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Acciones" }));
  await user.click(
    await screen.findByRole("menuitem", { name: "Eliminar mazo" }),
  );
  return user;
}

// Phase 8 H17: "Eliminar mazo" from a flashcards hub card, confirmed in an
// app dialog (never a native browser dialog).
describe("DeleteDeck", () => {
  beforeEach(() => {
    archiveDeckAction.mockReset();
    refresh.mockReset();
  });

  it("asks for confirmation in a dialog and deletes the deck on confirm", async () => {
    archiveDeckAction.mockResolvedValue({ ok: true, value: { archived: 3 } });
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = await openConfirm();

    expect(
      await screen.findByRole("dialog", {
        name: "¿Eliminar el mazo «Tema 1»?",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar mazo" }));

    expect(archiveDeckAction).toHaveBeenCalledWith({ pageId: "p1" });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with the reason when deleting fails", async () => {
    archiveDeckAction.mockResolvedValue({
      ok: false,
      error: { code: "FLASHCARD_NOT_FOUND", message: "x" },
    });
    const user = await openConfirm();

    await user.click(
      await screen.findByRole("button", { name: "Eliminar mazo" }),
    );

    expect(
      await screen.findByText("Este mazo ya no existe."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does nothing on cancel", async () => {
    const user = await openConfirm();
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(archiveDeckAction).not.toHaveBeenCalled();
  });
});
