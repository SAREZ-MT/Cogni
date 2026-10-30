import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { saveDeckEditsAction } = vi.hoisted(() => ({
  saveDeckEditsAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({
  MAX_FLASHCARD_SIDE_LENGTH: 1000,
  saveDeckEditsAction,
}));

import { DeckEditor } from "./deck-editor";

const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";
const card = (id: string, front: string, updatedAt: string) => ({
  id,
  pageId: PAGE,
  front,
  back: `Reverso de ${front}`,
  position: 0,
  updatedAt,
});
const CARDS = [
  card("c1", "Frente 1", "2026-10-01T10:00:00.000Z"),
  card("c2", "Frente 2", "2026-10-02T10:00:00.000Z"),
];

async function editFirstFront(text: string) {
  const user = userEvent.setup();
  render(<DeckEditor pageId={PAGE} cards={CARDS} />);
  const [front] = screen.getAllByLabelText("Frente");
  await user.clear(front as HTMLElement);
  await user.type(front as HTMLElement, text);
  await user.click(screen.getByRole("button", { name: "Guardar" }));
}

// Phase 8 H18 deck edit page, V10: the save sends each edited card with the
// version it was loaded at, and every refusal reads as plain Spanish.
describe("DeckEditor", () => {
  beforeEach(() => saveDeckEditsAction.mockReset());

  it("saves an edit with the card's loaded version", async () => {
    saveDeckEditsAction.mockResolvedValue({
      ok: true,
      value: { cards: [card("c1", "Nuevo", "2026-10-29T10:00:00.000Z")] },
    });

    await editFirstFront("Nuevo");

    expect(saveDeckEditsAction).toHaveBeenCalledWith({
      pageId: PAGE,
      updates: [
        {
          id: "c1",
          expectedUpdatedAt: "2026-10-01T10:00:00.000Z",
          front: "Nuevo",
          back: "Reverso de Frente 1",
        },
      ],
      creates: [],
      deletes: [],
    });
    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument();
  });

  it.each([
    ["FLASHCARD_CHANGED", /cambió en otra pestaña/],
    ["FLASHCARD_NOT_FOUND", /cambió mientras lo editabas/],
    ["SOMETHING_ELSE", /No pudimos guardar los cambios/],
  ])("explains a %s refusal and keeps the draft", async (code, copy) => {
    saveDeckEditsAction.mockResolvedValue({
      ok: false,
      error: { code, message: "x" },
    });

    await editFirstFront("Nuevo");

    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(screen.getByText("1 cambio sin guardar")).toBeInTheDocument();
  });
});
