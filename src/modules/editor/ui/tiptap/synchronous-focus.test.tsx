import { fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteBlock,
  duplicateBlock,
  resetBlockFormatting,
  resolveBlockAt,
} from "./block-actions";
import {
  applyBlockBackground,
  applyBlockTextColor,
  applySelectionTextColor,
} from "./block-color-palette";
import { BlockHandle } from "./block-handle";
import { BLOCK_KIND_ITEMS } from "./block-kind";
import { createEditorExtensions } from "./extensions";
import { HighlightPickerControls } from "./highlight-picker-controls";
import { TableToolbarControls } from "./table-toolbar";

// Every command a floating control runs hands focus back to the editor with
// ProseMirror's own synchronous `view.focus()`. Tiptap's `chain().focus()`
// defers the real DOM focus to a requestAnimationFrame callback, a frame in
// which the control that was just clicked can unmount and park focus on
// <body>. Each case runs the action and asserts `view.focus` was already
// called, before any frame can pass.
vi.mock("@tiptap/extension-drag-handle-react", () => ({
  default: ({
    editor,
    onNodeChange,
    children,
  }: {
    editor: Editor;
    onNodeChange?: (data: {
      node: ReturnType<Editor["state"]["doc"]["nodeAt"]>;
      editor: Editor;
      pos: number;
    }) => void;
    children: React.ReactNode;
  }) => {
    onNodeChange?.({ node: editor.state.doc.firstChild, editor, pos: 0 });
    return <div>{children}</div>;
  },
}));

const TABLE =
  "<table><tbody><tr><th><p>a</p></th><th><p>b</p></th></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>";

describe("synchronous focus return", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  function create(content: string) {
    editor = new Editor({ extensions: createEditorExtensions(), content });
    return vi.spyOn(editor.view, "focus");
  }

  function firstBlock() {
    const ref = resolveBlockAt(editor, 0);
    if (!ref) throw new Error("no first block");
    return ref;
  }

  it.each(
    BLOCK_KIND_ITEMS.map((item) => [item.id, item] as const),
  )("block kind %s", (_id, item) => {
    const focus = create("<p>hola</p>");
    editor.commands.setTextSelection(2);

    item.run(editor);

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("table toolbar buttons", () => {
    const focus = create(TABLE);
    editor.commands.setTextSelection(6);
    render(<TableToolbarControls editor={editor} />);

    for (const id of [
      "add-row-before",
      "add-row-after",
      "add-column-before",
      "add-column-after",
      "merge-cells",
      "split-cell",
      "toggle-header-row",
      "delete-row",
      "delete-column",
      "delete-table",
    ]) {
      focus.mockClear();
      fireEvent.click(screen.getByTestId(`table-toolbar-${id}`));
      expect(focus, id).toHaveBeenCalledTimes(1);
    }
  });

  it("highlight swatches and the remove-highlight action", () => {
    const focus = create("<p>hola</p>");
    editor.commands.selectAll();
    render(<HighlightPickerControls editor={editor} />);

    fireEvent.click(screen.getByTestId("highlight-swatch-purple"));
    expect(focus).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("highlight-remove"));
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("selection text color and block text color / background", () => {
    const focus = create("<p>hola</p>");
    editor.commands.selectAll();

    applySelectionTextColor(editor, "purple");
    expect(focus).toHaveBeenCalledTimes(1);

    applyBlockTextColor(editor, firstBlock(), "pink");
    expect(focus).toHaveBeenCalledTimes(2);

    applyBlockBackground(editor, firstBlock(), "green");
    expect(focus).toHaveBeenCalledTimes(3);
  });

  it("duplicate, delete and reset formatting on a block", () => {
    const focus = create("<p>uno</p><p>dos</p>");

    duplicateBlock(editor, firstBlock());
    expect(focus).toHaveBeenCalledTimes(1);

    resetBlockFormatting(editor, firstBlock());
    expect(focus).toHaveBeenCalledTimes(2);

    deleteBlock(editor, firstBlock());
    expect(focus).toHaveBeenCalledTimes(3);
  });

  it("the gutter + button after inserting its paragraph", () => {
    const focus = create("<p>hola</p>");
    render(<BlockHandle editor={editor} />);

    fireEvent.click(screen.getByTestId("block-insert"));

    expect(focus).toHaveBeenCalledTimes(1);
  });
});

describe("BlockHandle grip", () => {
  it("stays out of the Tab order and never steals focus from the editor on mousedown", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>hola</p>",
    });
    try {
      render(<BlockHandle editor={editor} />);
      const grip = screen.getByTestId("block-drag-handle");

      expect(grip).toHaveAttribute("tabindex", "-1");
      expect(fireEvent.mouseDown(grip)).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});
