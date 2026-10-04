import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { archiveFlashcardAction } = vi.hoisted(() => ({
  archiveFlashcardAction: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({ archiveFlashcardAction }));
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ArchiveFlashcardButton } from "./archive-flashcard-button";

const CARD = "2c3d4e5f-6071-4283-99aa-c3d4e5f60718";

async function openConfirm() {
  const user = userEvent.setup();
  render(<ArchiveFlashcardButton flashcardId={CARD} />);
  await user.click(screen.getByRole("button", { name: "Archivar tarjeta" }));
  return user;
}

describe("ArchiveFlashcardButton", () => {
  beforeEach(() => {
    archiveFlashcardAction.mockReset();
    refresh.mockReset();
  });

  it("asks for confirmation before archiving", async () => {
    await openConfirm();

    expect(
      screen.getByRole("dialog", { name: "¿Archivar esta tarjeta?" }),
    ).toBeInTheDocument();
    expect(archiveFlashcardAction).not.toHaveBeenCalled();
  });

  it("archives the card, closes and refreshes the deck", async () => {
    archiveFlashcardAction.mockResolvedValue({
      ok: true,
      value: { remaining: 1 },
    });
    const user = await openConfirm();

    await user.click(screen.getByRole("button", { name: "Archivar" }));

    expect(archiveFlashcardAction).toHaveBeenCalledWith({ flashcardId: CARD });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("explains the refusal on the last card and keeps the deck as is", async () => {
    archiveFlashcardAction.mockResolvedValue({
      ok: false,
      error: { code: "FLASHCARD_LAST_CARD", message: "x" },
    });
    const user = await openConfirm();

    await user.click(screen.getByRole("button", { name: "Archivar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Un mazo siempre conserva al menos una tarjeta. Agrega otra antes de archivar esta.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the generic failure for any other refusal or a thrown action", async () => {
    archiveFlashcardAction.mockRejectedValue(new Error("network"));
    const user = await openConfirm();

    await user.click(screen.getByRole("button", { name: "Archivar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos archivar la tarjeta. Intenta de nuevo.",
    );
  });

  it("clears a previous refusal when the confirmation is reopened", async () => {
    archiveFlashcardAction.mockResolvedValue({
      ok: false,
      error: { code: "FLASHCARD_LAST_CARD", message: "x" },
    });
    const user = await openConfirm();
    await user.click(screen.getByRole("button", { name: "Archivar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await user.click(screen.getByRole("button", { name: "Archivar tarjeta" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
