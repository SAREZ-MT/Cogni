import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import type { BlockRef } from "./block-actions";
import {
  applyBlockBackground,
  applyBlockTextColor,
  applySelectionTextColor,
  BACKGROUND_COLOR_SWATCHES,
  TEXT_COLOR_SWATCHES,
} from "./block-color-palette";
import { createEditorExtensions } from "./extensions";
import { HIGHLIGHT_PALETTE } from "./highlight-palette";

describe("color swatches", () => {
  it("offers a default plus one swatch per palette color, for text and background", () => {
    for (const swatches of [TEXT_COLOR_SWATCHES, BACKGROUND_COLOR_SWATCHES]) {
      expect(swatches.map((swatch) => swatch.id)).toEqual([
        "default",
        ...HIGHLIGHT_PALETTE,
      ]);
      expect(
        swatches.every((swatch) => swatch.label && swatch.swatchClass),
      ).toBe(true);
    }
    expect(TEXT_COLOR_SWATCHES[0].label).toBe("Predeterminado");
    expect(BACKGROUND_COLOR_SWATCHES[0].label).toBe("Sin fondo");
  });

  it("uses the accessible -fg token for text swatches and the pastel for backgrounds", () => {
    const purpleText = TEXT_COLOR_SWATCHES.find((s) => s.id === "purple");
    const purpleBg = BACKGROUND_COLOR_SWATCHES.find((s) => s.id === "purple");
    expect(purpleText?.swatchClass).toBe("bg-pastel-purple-fg");
    expect(purpleBg?.swatchClass).toBe("bg-pastel-purple");
  });
});

describe("applying colors", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  function create(content: string) {
    editor = new Editor({ extensions: createEditorExtensions(), content });
    return editor;
  }

  function firstBlock(): BlockRef {
    const node = editor.state.doc.child(0);
    return { node, pos: 0 };
  }

  function textColors() {
    return editor.state.doc
      .child(0)
      .children.flatMap((child) => child.marks)
      .filter((mark) => mark.type.name === "textStyle")
      .map((mark) => mark.attrs.color);
  }

  it("applySelectionTextColor colors only the selection with the -fg token", () => {
    create("<p>hola cogni</p>");
    editor.commands.setTextSelection({ from: 1, to: 5 });

    applySelectionTextColor(editor, "pink");

    expect(textColors()).toEqual(["var(--color-pastel-pink-fg)"]);
    expect(editor.state.doc.child(0).child(0).text).toBe("hola");
  });

  it("applySelectionTextColor('default') removes the color again", () => {
    create("<p>hola</p>");
    editor.commands.selectAll();
    applySelectionTextColor(editor, "green");
    expect(textColors()).toHaveLength(1);

    applySelectionTextColor(editor, "default");

    expect(textColors()).toHaveLength(0);
  });

  it("applyBlockTextColor colors the whole block content", () => {
    create("<p>hola <strong>cogni</strong></p>");

    applyBlockTextColor(editor, firstBlock(), "blue");

    const colored = editor.state.doc
      .child(0)
      .children.map(
        (child) =>
          child.marks.find((mark) => mark.type.name === "textStyle")?.attrs
            .color,
      );
    expect(colored).toEqual([
      "var(--color-pastel-blue-fg)",
      "var(--color-pastel-blue-fg)",
    ]);
  });

  it("applyBlockTextColor('default') clears a previously applied color", () => {
    create("<p>hola</p>");
    applyBlockTextColor(editor, firstBlock(), "orange");
    applyBlockTextColor(editor, firstBlock(), "default");
    expect(textColors()).toHaveLength(0);
  });

  it("applyBlockBackground sets and clears the block's nodeBackground", () => {
    create("<h2>titulo</h2>");

    applyBlockBackground(editor, firstBlock(), "mint");
    expect(editor.state.doc.child(0).attrs.nodeBackground).toBe("mint");

    applyBlockBackground(editor, firstBlock(), "default");
    expect(editor.state.doc.child(0).attrs.nodeBackground).toBeNull();
  });

  it("applyBlockBackground ignores a block type that cannot carry a background", () => {
    create("<pre><code>x</code></pre>");
    const before = editor.getJSON();

    applyBlockBackground(editor, firstBlock(), "pink");

    expect(editor.getJSON()).toEqual(before);
  });
});
