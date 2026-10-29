import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditorExtensions } from "./extensions";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_STORAGE_KEY,
  HIGHLIGHTER_COLORS,
  quickHighlight,
  readLastHighlightColor,
  rememberHighlightColor,
} from "./quick-highlight";

function highlightColorAt(editor: Editor): unknown {
  return editor.getAttributes("highlight").color ?? null;
}

// H6-E6 (odd/tasks/phase-8-design-flows.md): one-click highlighting with the
// last colour used, plus Mod+Shift+H.
describe("quick highlight", () => {
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
    vi.restoreAllMocks();
  });

  it("offers six AA-readable palette colours, yellow first", () => {
    expect(HIGHLIGHTER_COLORS).toEqual([
      "yellow",
      "green",
      "blue",
      "pink",
      "purple",
      "orange",
    ]);
    expect(DEFAULT_HIGHLIGHT_COLOR).toBe("yellow");
  });

  it("starts from yellow and remembers the last colour chosen", () => {
    expect(readLastHighlightColor()).toBe("yellow");
    rememberHighlightColor("blue");
    expect(readLastHighlightColor()).toBe("blue");
    expect(window.localStorage.getItem(HIGHLIGHT_STORAGE_KEY)).toBe("blue");
  });

  it("ignores a stored value outside the palette", () => {
    window.localStorage.setItem(HIGHLIGHT_STORAGE_KEY, "#ff0000");
    expect(readLastHighlightColor()).toBe("yellow");
  });

  it("keeps working in memory when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    rememberHighlightColor("pink");
    expect(readLastHighlightColor()).toBe("pink");
  });

  it("applies the last colour in one call, and removes it on a second", () => {
    rememberHighlightColor("green");
    expect(quickHighlight(editor)).toBe(true);
    expect(highlightColorAt(editor)).toBe("green");

    expect(quickHighlight(editor)).toBe(true);
    expect(editor.isActive("highlight")).toBe(false);
  });

  it("recolours a highlight that uses another colour instead of removing it", () => {
    editor.commands.setHighlight({ color: "pink" });
    rememberHighlightColor("blue");
    quickHighlight(editor);
    expect(highlightColorAt(editor)).toBe("blue");
  });

  it("does nothing on an empty selection", () => {
    editor.commands.setTextSelection(2);
    expect(quickHighlight(editor)).toBe(false);
  });

  it("binds Mod+Shift+H to the last colour", () => {
    rememberHighlightColor("purple");
    const event = new KeyboardEvent("keydown", {
      key: "H",
      keyCode: 72,
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const handled = editor.view.someProp("handleKeyDown", (handler) =>
      handler(editor.view, event),
    );
    expect(handled).toBe(true);
    expect(highlightColorAt(editor)).toBe("purple");
  });
});
