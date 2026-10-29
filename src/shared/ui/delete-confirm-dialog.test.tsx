import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

function Host(props: {
  loadSummary: () => Promise<string | null>;
  onConfirm: () => Promise<string | null>;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar el cuaderno «Biología»?"
        confirmLabel="Eliminar cuaderno"
        emptySummary="El cuaderno está vacío."
        loadSummary={props.loadSummary}
        onConfirm={props.onConfirm}
        onDeleted={props.onDeleted ?? (() => {})}
      />
    </>
  );
}

describe("DeleteConfirmDialog (Phase 8 H19)", () => {
  it("reads what will be deleted when it opens, then deletes on confirm", async () => {
    const user = userEvent.setup();
    const loadSummary = vi.fn(async () => "Se eliminarán 4 páginas.");
    const onConfirm = vi.fn(async () => null);
    const onDeleted = vi.fn();
    render(
      <Host
        loadSummary={loadSummary}
        onConfirm={onConfirm}
        onDeleted={onDeleted}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const dialog = screen.getByRole("dialog", {
      name: "¿Eliminar el cuaderno «Biología»?",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      await screen.findByText("Se eliminarán 4 páginas."),
    ).toBeInTheDocument();
    expect(screen.getByText(/no se puede deshacer/)).toBeInTheDocument();
    expect(loadSummary).toHaveBeenCalledTimes(1);
    // The H18 destructive styling beside an outline Cancelar.
    expect(
      screen.getByRole("button", { name: "Eliminar cuaderno" }),
    ).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveAttribute(
      "data-variant",
      "outline",
    );

    await user.click(screen.getByRole("button", { name: "Eliminar cuaderno" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the delete button disabled until the summary is read", async () => {
    const user = userEvent.setup();
    let resolve: (value: string | null) => void = () => {};
    const loadSummary = () =>
      new Promise<string | null>((done) => {
        resolve = done;
      });
    render(<Host loadSummary={loadSummary} onConfirm={async () => null} />);

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(
      screen.getByRole("button", { name: "Eliminar cuaderno" }),
    ).toBeDisabled();
    resolve(null);
    expect(
      await screen.findByText("El cuaderno está vacío."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar cuaderno" }),
    ).toBeEnabled();
  });

  it("shows a failed read and never deletes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => null);
    render(
      <Host
        loadSummary={async () => {
          throw new Error("boom");
        }}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos revisar qué se eliminará",
    );
    expect(
      screen.getByRole("button", { name: "Eliminar cuaderno" }),
    ).toBeDisabled();
  });

  it("keeps the dialog open with the reason when the delete fails", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    render(
      <Host
        loadSummary={async () => "Se eliminarán 2 mazos."}
        onConfirm={async () => "Este cuaderno ya no existe."}
        onDeleted={onDeleted}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByText("Se eliminarán 2 mazos.");
    await user.click(screen.getByRole("button", { name: "Eliminar cuaderno" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este cuaderno ya no existe.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
