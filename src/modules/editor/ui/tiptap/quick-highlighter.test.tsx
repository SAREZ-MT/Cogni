import { act, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BubbleToolbarControls } from "./bubble-toolbar";
import { createEditorExtensions } from "./extensions";
import { readLastHighlightColor } from "./quick-highlight";

// H6-E6: the bubble toolbar's highlighter — one click for the last colour,
// a swatch row for another, and "Quitar resaltado".
describe("bubble toolbar highlighter", () => {
  let editor: Editor;

  beforeEach(() => {
    window.localStorage.clear();
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>hola cogni</p>",
    });
    editor.commands.setTextSelection({ from: 1, to: 5 });
  });

  afterEach(() => {
    editor.destroy();
  });

  it("highlights the selection in the last colour with one click", () => {
    render(<BubbleToolbarControls editor={editor} />);

    const button = screen.getByRole("button", { name: "Resaltar en amarillo" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    act(() => {
      fireEvent.click(button);
    });

    expect(editor.getAttributes("highlight").color).toBe("yellow");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("picks another colour from the swatch row and remembers it for the next click", async () => {
    render(<BubbleToolbarControls editor={editor} />);

    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Más colores de resaltado" }),
      );
    });
    const row = await screen.findByRole("group", {
      name: "Colores de resaltado",
    });
    // H7 follow-up: circular pastel swatches, each with a thin border in
    // its hue, then a divider and the "no highlight" icon.
    const swatches = row.querySelectorAll("button[data-color]");
    expect(swatches).toHaveLength(5);
    for (const swatch of swatches) {
      const dot = swatch.querySelector("span");
      expect(dot?.className).toContain("rounded-full");
      expect(dot?.className).toMatch(/border-highlighter-\w+-edge/);
      expect(swatch).toHaveTextContent("");
    }
    expect(screen.getByRole("separator")).toBeInTheDocument();
    const remove = screen.getByRole("button", { name: "Quitar resaltado" });
    expect(remove).toHaveTextContent("");
    expect(remove.querySelector("svg")).not.toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Resaltar en azul" }));
    });

    expect(editor.getAttributes("highlight").color).toBe("blue");
    expect(readLastHighlightColor()).toBe("blue");
    expect(screen.getByTestId("bubble-toolbar-highlight")).toHaveAccessibleName(
      "Resaltar en azul",
    );
  });

  it("removes the highlight with 'Quitar resaltado'", async () => {
    editor.commands.setHighlight({ color: "pink" });
    render(<BubbleToolbarControls editor={editor} />);

    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Más colores de resaltado" }),
      );
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Quitar resaltado" }));
    });

    expect(editor.isActive("highlight")).toBe(false);
  });
});
