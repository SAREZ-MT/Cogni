import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFlashcardAction } = vi.hoisted(() => ({
  createFlashcardAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({
  createFlashcardAction,
  MAX_FLASHCARD_SIDE_LENGTH: 1000,
}));
const { refresh, replace } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
  usePathname: () => "/flashcards/nb/pg",
}));

import { NewFlashcardDialog } from "./new-flashcard-dialog";

const PAGE = "1b2c3d4e-5f60-4172-8899-b2c3d4e5f607";

async function openDialog() {
  const user = userEvent.setup();
  render(<NewFlashcardDialog pageId={PAGE} />);
  await user.click(screen.getByRole("button", { name: "Nueva tarjeta" }));
  return user;
}

describe("NewFlashcardDialog", () => {
  beforeEach(() => {
    createFlashcardAction.mockReset();
    refresh.mockReset();
    replace.mockReset();
  });

  // Phase 8 H11: "Crear a mano" from a technique hub lands on the page's
  // deck with `?nueva=1`, which opens this dialog at once for the first
  // card; the flag is dropped from the URL so a reload does not reopen it.
  it("opens at once when asked to, and drops the flag from the URL", () => {
    render(<NewFlashcardDialog pageId={PAGE} initialOpen />);

    expect(
      screen.getByRole("dialog", { name: "Nueva tarjeta" }),
    ).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/flashcards/nb/pg", {
      scroll: false,
    });
  });

  it("starts closed by default", () => {
    render(<NewFlashcardDialog pageId={PAGE} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens a dialog with the front and back fields, bounded to the side limit", async () => {
    await openDialog();

    expect(
      screen.getByRole("dialog", { name: "Nueva tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Anverso")).toHaveAttribute(
      "maxLength",
      "1000",
    );
    expect(screen.getByLabelText("Reverso")).toHaveAttribute(
      "maxLength",
      "1000",
    );
  });

  it("keeps Guardar disabled until both sides have text", async () => {
    const user = await openDialog();
    const save = screen.getByRole("button", { name: "Guardar tarjeta" });

    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Anverso"), "¿Qué es el ATP?");
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Reverso"), "   ");
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Reverso"), "Energía");
    expect(save).toBeEnabled();
  });

  it("creates the card on the page's deck, closes and refreshes the route", async () => {
    createFlashcardAction.mockResolvedValue({
      ok: true,
      value: { id: "c1", pageId: PAGE, front: "F", back: "R", position: 0 },
    });
    const user = await openDialog();

    await user.type(screen.getByLabelText("Anverso"), "F");
    await user.type(screen.getByLabelText("Reverso"), "R");
    await user.click(screen.getByRole("button", { name: "Guardar tarjeta" }));

    expect(createFlashcardAction).toHaveBeenCalledWith({
      pageId: PAGE,
      front: "F",
      back: "R",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("starts empty again after a card was created", async () => {
    createFlashcardAction.mockResolvedValue({
      ok: true,
      value: { id: "c1", pageId: PAGE, front: "F", back: "R", position: 0 },
    });
    const user = await openDialog();
    await user.type(screen.getByLabelText("Anverso"), "F");
    await user.type(screen.getByLabelText("Reverso"), "R");
    await user.click(screen.getByRole("button", { name: "Guardar tarjeta" }));

    await user.click(screen.getByRole("button", { name: "Nueva tarjeta" }));

    expect(screen.getByLabelText("Anverso")).toHaveValue("");
    expect(screen.getByLabelText("Reverso")).toHaveValue("");
  });

  it.each([
    ["FLASHCARD_TOO_LONG", "Cada lado admite hasta 1000 caracteres."],
    [
      "FLASHCARDS_UNEXPECTED",
      "No pudimos guardar la tarjeta. Intenta de nuevo.",
    ],
  ])("shows the %s refusal and keeps the dialog open", async (code, copy) => {
    createFlashcardAction.mockResolvedValue({
      ok: false,
      error: { code, message: "x" },
    });
    const user = await openDialog();

    await user.type(screen.getByLabelText("Anverso"), "F");
    await user.type(screen.getByLabelText("Reverso"), "R");
    await user.click(screen.getByRole("button", { name: "Guardar tarjeta" }));

    expect(screen.getByRole("alert")).toHaveTextContent(copy);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Anverso")).toHaveValue("F");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the generic failure when the action throws", async () => {
    createFlashcardAction.mockRejectedValue(new Error("network"));
    const user = await openDialog();

    await user.type(screen.getByLabelText("Anverso"), "F");
    await user.type(screen.getByLabelText("Reverso"), "R");
    await user.click(screen.getByRole("button", { name: "Guardar tarjeta" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos guardar la tarjeta. Intenta de nuevo.",
    );
  });
});
