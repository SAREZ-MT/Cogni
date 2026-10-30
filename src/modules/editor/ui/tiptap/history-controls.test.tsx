import { act, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorExtensions } from "./extensions";
import { HistoryControls } from "./history-controls";

// H7 (editor polish round 2): subtle undo/redo arrows next to the page's
// "Editada…" status, on the editor's own history.
describe("HistoryControls", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  function setup() {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>hola</p>",
    });
    render(<HistoryControls editor={editor} />);
    return {
      undo: screen.getByRole("button", { name: "Deshacer cambio" }),
      redo: screen.getByRole("button", { name: "Rehacer cambio" }),
    };
  }

  it("groups two keyboard-reachable buttons with their shortcuts", () => {
    const { undo, redo } = setup();
    expect(screen.getByRole("group", { name: "Historial" })).toBeVisible();
    expect(undo).toHaveAttribute("aria-keyshortcuts", "Meta+Z Control+Z");
    expect(redo).toHaveAttribute(
      "aria-keyshortcuts",
      "Meta+Shift+Z Control+Shift+Z",
    );
    expect(undo.tagName).toBe("BUTTON");
  });

  it("is disabled until there is something to undo or redo", () => {
    const { undo, redo } = setup();
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    act(() => {
      editor.chain().focus("end").insertContent(" cogni").run();
    });
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();
  });

  it("undoes and redoes the last change", () => {
    const { undo, redo } = setup();
    act(() => {
      editor.chain().focus("end").insertContent(" cogni").run();
    });

    fireEvent.click(undo);
    expect(editor.getText()).toBe("hola");
    expect(redo).toBeEnabled();

    fireEvent.click(redo);
    expect(editor.getText()).toBe("hola cogni");
  });
});
