import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockContextMenu } from "./block-context-menu";
import { createEditorExtensions } from "./extensions";

// Row wiring of the grip's context menu: every row must act on the block the
// grip was opened on (re-resolved from the live document), through the same
// block-actions the keyboard shortcuts use. Selection/focus recovery on close
// is browser-only behavior and is not part of this file.
function texts(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.forEach((node) => {
    out.push(node.textContent);
  });
  return out;
}

describe("BlockContextMenu rows", () => {
  let editor: Editor;
  let hoveredPos: number | null;

  beforeEach(() => {
    hoveredPos = 0;
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>uno</p><p>dos</p>",
    });
  });

  afterEach(() => {
    editor.destroy();
    vi.unstubAllGlobals();
  });

  async function openMenu() {
    const user = userEvent.setup();
    render(
      <BlockContextMenu editor={editor} getHoveredPos={() => hoveredPos}>
        <button type="button">Opciones del bloque</button>
      </BlockContextMenu>,
    );
    await user.click(
      screen.getByRole("button", { name: "Opciones del bloque" }),
    );
    await screen.findByRole("menuitem", { name: /Duplicar/ });
    return user;
  }

  it("lists the block actions with their shortcuts", async () => {
    await openMenu();

    for (const name of [
      /Convertir en/,
      /Colores/,
      /Copiar\s*⌘⇧C/,
      /Duplicar\s*⌘D/,
      /Copiar enlace/,
      /Restablecer formato/,
      /Eliminar\s*⌘⌫/,
    ]) {
      expect(screen.getByRole("menuitem", { name })).toBeVisible();
    }
  });

  it("only offers Descargar on an image block", async () => {
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: /Descargar/ })).toBeNull();
  });

  it("offers Descargar on an image block", async () => {
    editor.commands.setContent({
      type: "doc",
      content: [{ type: "image", attrs: { assetId: null } }],
    });
    await openMenu();
    expect(screen.getByRole("menuitem", { name: /Descargar/ })).toBeVisible();
  });

  it("Duplicar copies the hovered block right after it", async () => {
    hoveredPos = editor.state.doc.child(0).nodeSize; // second block
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Duplicar/ }));

    expect(texts(editor)).toEqual(["uno", "dos", "dos"]);
  });

  it("Eliminar removes the hovered block", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Eliminar/ }));

    expect(texts(editor)).toEqual(["dos"]);
  });

  it("Copiar writes the block's text to the clipboard", async () => {
    const user = await openMenu();
    // After openMenu: user-event installs its own clipboard stub in setup().
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await user.click(screen.getByRole("menuitem", { name: /^Copiar\s*⌘/ }));

    expect(writeText).toHaveBeenCalledWith("uno");
  });

  it("Restablecer formato clears marks on the hovered block", async () => {
    editor.commands.setContent("<p><strong>uno</strong></p>");
    const user = await openMenu();

    await user.click(
      screen.getByRole("menuitem", { name: /Restablecer formato/ }),
    );

    expect(editor.state.doc.child(0).child(0).marks).toHaveLength(0);
  });

  it("Convertir en turns the hovered block into the chosen kind", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Convertir en/ }));
    // fireEvent: user-event's pointer travel makes Radix's submenu grace
    // area close the submenu before the click lands in jsdom.
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Encabezado 2/ }),
    );

    expect(editor.state.doc.child(0).type.name).toBe("heading");
    expect(editor.state.doc.child(0).attrs.level).toBe(2);
    expect(editor.state.doc.child(1).type.name).toBe("paragraph");
  });

  it("Convertir en targets the hovered block, not the first one", async () => {
    hoveredPos = editor.state.doc.child(0).nodeSize; // second block
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Convertir en/ }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Encabezado 1/ }),
    );

    expect(editor.state.doc.child(0).type.name).toBe("paragraph");
    expect(editor.state.doc.child(1).type.name).toBe("heading");
  });

  it("re-resolves the block when the menu acts, so a document that shrank meanwhile is left alone", async () => {
    hoveredPos = editor.state.doc.child(0).nodeSize; // second block
    const user = await openMenu();
    editor.commands.setContent("<p>solo</p>");

    await user.click(screen.getByRole("menuitem", { name: /Eliminar/ }));

    expect(texts(editor)).toEqual(["solo"]);
  });

  it("Colores > Fondo tints the hovered block", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Colores/ }));
    fireEvent.click(await screen.findByTestId("block-menu-background-pink"));

    expect(editor.state.doc.child(0).attrs.nodeBackground).toBe("pink");
  });

  it("Colores > Texto colors the hovered block's text", async () => {
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Colores/ }));
    fireEvent.click(await screen.findByTestId("block-menu-text-color-green"));

    const mark = editor.state.doc
      .child(0)
      .child(0)
      .marks.find((m) => m.type.name === "textStyle");
    expect(mark?.attrs.color).toBe("var(--color-pastel-green-fg)");
  });

  it("does nothing when the hovered position no longer resolves to a block", async () => {
    hoveredPos = null;
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: /Eliminar/ }));

    await waitFor(() => expect(texts(editor)).toEqual(["uno", "dos"]));
  });
});
