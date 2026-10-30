import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { ItemEditor, type ItemEditorProps } from "./item-editor";

interface Note {
  text: string;
}

const onSave = vi.fn<ItemEditorProps<Note>["onSave"]>();

function setup(
  items = [
    { id: "a", value: { text: "Primera" } },
    { id: "b", value: { text: "Segunda" } },
  ],
) {
  const user = userEvent.setup();
  render(
    <>
      <a href="/flashcards">Volver</a>
      <ItemEditor<Note>
        items={items}
        itemLabel="Tarjeta"
        addLabel="Añadir tarjeta"
        lastItemMessage="El mazo necesita al menos una tarjeta."
        emptyValue={() => ({ text: "" })}
        validate={(value) =>
          value.text.trim() === "" ? { text: "Escribe el texto." } : {}
        }
        renderFields={({ value, onChange, errors, idPrefix }) => (
          <>
            <label htmlFor={`${idPrefix}-text`}>Texto</label>
            <input
              id={`${idPrefix}-text`}
              value={value.text}
              onChange={(event) => onChange({ text: event.target.value })}
            />
            {errors.text && <p>{errors.text}</p>}
          </>
        )}
        onSave={onSave}
      />
    </>,
  );
  return user;
}

const cards = () => screen.getAllByTestId("item-editor-entry");

describe("ItemEditor (Phase 8 H18 edit pages)", () => {
  beforeEach(() => {
    onSave.mockReset();
    push.mockReset();
    refresh.mockReset();
  });

  it("lists every item numbered, with nothing to save at first", () => {
    setup();

    expect(cards()).toHaveLength(2);
    expect(
      within(cards()[0] as HTMLElement).getByText("Tarjeta 1"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sin cambios")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("keeps edits, additions and deletions as a local draft and saves them at once", async () => {
    onSave.mockResolvedValue({
      ok: true,
      items: [
        { id: "a", value: { text: "Primera editada" } },
        { id: "n", value: { text: "Nueva" } },
      ],
    });
    const user = setup();

    const first = screen.getAllByLabelText("Texto")[0] as HTMLElement;
    await user.clear(first);
    await user.type(first, "Primera editada");
    await user.click(
      within(cards()[1] as HTMLElement).getByRole("button", {
        name: "Eliminar tarjeta 2",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Añadir tarjeta" }));
    await user.type(
      screen.getAllByLabelText("Texto").at(-1) as HTMLElement,
      "Nueva",
    );

    expect(screen.getByText("3 cambios sin guardar")).toBeInTheDocument();
    expect(screen.getByText("Se eliminará al guardar")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSave).toHaveBeenCalledWith({
      updates: [{ id: "a", text: "Primera editada" }],
      creates: [{ text: "Nueva" }],
      deletes: ["b"],
    });
    expect(await screen.findByText("Cambios guardados")).toBeInTheDocument();
    expect(cards()).toHaveLength(2);
    expect(screen.getByText("Sin cambios")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("brings a deleted item back with Deshacer", async () => {
    const user = setup();

    await user.click(
      screen.getByRole("button", { name: "Eliminar tarjeta 1" }),
    );
    await user.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(screen.getByText("Sin cambios")).toBeInTheDocument();
  });

  it("shows validation errors inline and saves nothing", async () => {
    const user = setup();

    await user.clear(screen.getAllByLabelText("Texto")[0] as HTMLElement);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByText("Escribe el texto.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revisa los campos marcados",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("refuses to delete every item before asking the server", async () => {
    const user = setup();

    await user.click(
      screen.getByRole("button", { name: "Eliminar tarjeta 1" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Eliminar tarjeta 2" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El mazo necesita al menos una tarjeta.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the draft and says why when the save fails", async () => {
    onSave.mockResolvedValue({
      ok: false,
      message: "No pudimos guardar los cambios.",
    });
    const user = setup();

    await user.type(screen.getAllByLabelText("Texto")[0] as HTMLElement, "!");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar los cambios.",
    );
    expect(screen.getByText("1 cambio sin guardar")).toBeInTheDocument();
  });

  it("says why when the save throws", async () => {
    onSave.mockRejectedValue(new Error("network"));
    const user = setup();

    await user.type(screen.getAllByLabelText("Texto")[0] as HTMLElement, "!");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar los cambios. Intenta de nuevo.",
    );
  });

  it("discards the draft with Descartar cambios", async () => {
    const user = setup();

    await user.type(screen.getAllByLabelText("Texto")[0] as HTMLElement, "!");
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));

    expect(screen.getAllByLabelText("Texto")[0]).toHaveValue("Primera");
    expect(screen.getByText("Sin cambios")).toBeInTheDocument();
  });

  it("discards back to the last saved items, not to the ones the page first loaded", async () => {
    onSave.mockResolvedValue({
      ok: true,
      items: [
        { id: "a", value: { text: "Primera guardada" } },
        { id: "b", value: { text: "Segunda" } },
      ],
    });
    const user = setup();

    const [first] = screen.getAllByLabelText("Texto");
    await user.clear(first as HTMLElement);
    await user.type(first as HTMLElement, "Primera guardada");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Cambios guardados");
    await user.type(screen.getAllByLabelText("Texto")[0] as HTMLElement, "!");
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));

    expect(screen.getAllByLabelText("Texto")[0]).toHaveValue(
      "Primera guardada",
    );
    expect(screen.getByText("Sin cambios")).toBeInTheDocument();
  });

  it("asks before leaving through a link while there are unsaved changes", async () => {
    const user = setup();

    await user.type(screen.getAllByLabelText("Texto")[0] as HTMLElement, "!");
    await user.click(screen.getByRole("link", { name: "Volver" }));

    expect(
      screen.getByRole("dialog", { name: "¿Salir sin guardar?" }),
    ).toBeInTheDocument();
  });
});
