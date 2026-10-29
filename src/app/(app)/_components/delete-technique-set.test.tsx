import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

const mocks = vi.hoisted(() => ({
  previewDeckDeletionAction: vi.fn(),
  deleteDeckAction: vi.fn(),
  previewRecallSetDeletionAction: vi.fn(),
  deleteRecallSetAction: vi.fn(),
  previewExamSetDeletionAction: vi.fn(),
  deleteExamSetAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/modules/flashcards", () => ({
  previewDeckDeletionAction: mocks.previewDeckDeletionAction,
  deleteDeckAction: mocks.deleteDeckAction,
}));
vi.mock("@/modules/active-recall", () => ({
  previewRecallSetDeletionAction: mocks.previewRecallSetDeletionAction,
  deleteRecallSetAction: mocks.deleteRecallSetAction,
}));
vi.mock("@/modules/exams", () => ({
  previewExamSetDeletionAction: mocks.previewExamSetDeletionAction,
  deleteExamSetAction: mocks.deleteExamSetAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import {
  DeleteTechniqueSetMenuItem,
  DeleteTechniqueSetProvider,
  type TechniqueSetKind,
} from "./delete-technique-set";

async function openConfirm(kind: TechniqueSetKind, item: string) {
  render(
    <DeleteTechniqueSetProvider kind={kind} pageId="p1" title="Tema 1">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger>Acciones</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DeleteTechniqueSetMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </DeleteTechniqueSetProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Acciones" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
  return user;
}

// Phase 8 H19: a hub card's kebab deletes the page's whole set for real,
// after an app dialog shows the server's counts (never window.confirm).
describe("DeleteTechniqueSet", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("deletes a deck after showing its cards and review history", async () => {
    mocks.previewDeckDeletionAction.mockResolvedValue({
      ok: true,
      value: { cards: 12, reviews: 30 },
    });
    mocks.deleteDeckAction.mockResolvedValue({
      ok: true,
      value: { pageId: "p1" },
    });
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = await openConfirm("deck", "Eliminar mazo");

    expect(
      await screen.findByRole("dialog", {
        name: "¿Eliminar el mazo «Tema 1»?",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Se eliminarán 12 tarjetas y 30 repasos."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar mazo" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.deleteDeckAction).toHaveBeenCalledWith({ pageId: "p1" });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("deletes a recall set after showing its questions and sessions", async () => {
    mocks.previewRecallSetDeletionAction.mockResolvedValue({
      ok: true,
      value: { questions: 8, sessions: 1 },
    });
    mocks.deleteRecallSetAction.mockResolvedValue({
      ok: true,
      value: { pageId: "p1" },
    });
    const user = await openConfirm("recall", "Eliminar repaso");

    expect(
      await screen.findByText("Se eliminarán 8 preguntas y 1 sesión."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar repaso" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.deleteRecallSetAction).toHaveBeenCalledWith({ pageId: "p1" });
  });

  it("deletes an exam set after showing its questions and attempts", async () => {
    mocks.previewExamSetDeletionAction.mockResolvedValue({
      ok: true,
      value: { questions: 15, attempts: 4 },
    });
    mocks.deleteExamSetAction.mockResolvedValue({
      ok: true,
      value: { pageId: "p1" },
    });
    const user = await openConfirm("exam", "Eliminar examen");

    expect(
      await screen.findByRole("dialog", {
        name: "¿Eliminar el examen «Tema 1»?",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Se eliminarán 15 preguntas y 4 intentos."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar examen" }));

    await waitFor(() => expect(mocks.deleteExamSetAction).toHaveBeenCalled());
  });

  it("keeps the dialog open with the reason when the delete fails", async () => {
    mocks.previewDeckDeletionAction.mockResolvedValue({
      ok: true,
      value: { cards: 2, reviews: 0 },
    });
    mocks.deleteDeckAction.mockResolvedValue({
      ok: false,
      error: { code: "FLASHCARD_NOT_FOUND", message: "x" },
    });
    const user = await openConfirm("deck", "Eliminar mazo");
    await screen.findByText("Se eliminarán 2 tarjetas.");
    await user.click(screen.getByRole("button", { name: "Eliminar mazo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este mazo ya no existe.",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
