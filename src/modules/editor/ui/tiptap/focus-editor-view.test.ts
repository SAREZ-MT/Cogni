import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleGripMenuCloseAutoFocus } from "./block-context-menu";
import { createEditorExtensions } from "./extensions";
import { focusEditorView } from "./focus-editor-view";

describe("focusEditorView", () => {
  let editor: Editor;

  afterEach(() => {
    if (!editor.isDestroyed) editor.destroy();
  });

  function create() {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>hola</p>",
    });
  }

  it("focuses the view of a mounted editor", () => {
    create();
    const focus = vi.spyOn(editor.view, "focus");

    focusEditorView(editor);

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("does nothing, and does not throw, once the editor is destroyed", () => {
    create();
    editor.destroy();

    expect(() => focusEditorView(editor)).not.toThrow();
  });

  it("does nothing while the editor is unmounted", () => {
    create();
    editor.unmount();

    expect(() => focusEditorView(editor)).not.toThrow();
  });

  it("lets a closing grip menu finish after the editor is gone, still cancelling Radix's own refocus", () => {
    create();
    editor.destroy();
    const preventDefault = vi.fn();

    expect(() =>
      handleGripMenuCloseAutoFocus(editor, { preventDefault }),
    ).not.toThrow();
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
