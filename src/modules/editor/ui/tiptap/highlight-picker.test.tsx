import { fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { CogniHighlight } from "./highlight-palette";
import { HighlightPicker } from "./highlight-picker";
import { HighlightPickerControls } from "./highlight-picker-controls";

// specs/editor/spec.md, "Paleta de resaltado de Cogni y callouts", Scenario
// "Resaltado por nombre": choosing a color from the picker MUST produce
// `{ color: "<name>" }` in the JSON, closing the gap left by 5a.4 (the
// mark existed but had no reachable UI).
function createHeadlessEditor() {
  const editor = new Editor({
    extensions: [StarterKit, CogniHighlight],
    content: "<p>hola</p>",
  });
  editor.commands.selectAll();
  return editor;
}

describe("HighlightPickerControls", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("applies the purple highlight to the selection when 'morado' is chosen", () => {
    editor = createHeadlessEditor();
    render(<HighlightPickerControls editor={editor} />);

    fireEvent.click(screen.getByTestId("highlight-swatch-purple"));

    const json = editor.getJSON();
    const mark = json.content?.[0]?.content?.[0]?.marks?.find(
      (m) => m.type === "highlight",
    );
    expect(mark?.attrs).toEqual({ color: "purple" });
  });

  it("removes the highlight when 'quitar resaltado' is chosen", () => {
    editor = createHeadlessEditor();
    editor.commands.setHighlight({ color: "purple" });
    render(<HighlightPickerControls editor={editor} />);

    fireEvent.click(screen.getByTestId("highlight-remove"));

    const json = editor.getJSON();
    const marks = json.content?.[0]?.content?.[0]?.marks ?? [];
    expect(marks.find((m) => m.type === "highlight")).toBeUndefined();
  });

  it("labels every swatch and the remove control with an accessible name", () => {
    editor = createHeadlessEditor();
    render(<HighlightPickerControls editor={editor} />);

    expect(
      screen.getByRole("button", { name: "Resaltar en morado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quitar resaltado" }),
    ).toBeInTheDocument();
  });
});

// The real `BubbleMenu` wrapper relies on floating-ui layout math that
// jsdom cannot fully emulate; this smoke test only confirms it mounts and
// unmounts without throwing when there is no selection (its `shouldShow`
// stays false, so the plugin never attempts to position itself).
describe("HighlightPicker (smoke)", () => {
  it("mounts without throwing when there is no selection", () => {
    const editor = new Editor({
      extensions: [StarterKit, CogniHighlight],
      content: "<p>hola</p>",
    });

    // destroy() must run even if the assertion below throws, otherwise
    // ProseMirror's DOMObserver setTimeout flush can fire after Vitest has
    // torn down jsdom for this file, throwing "document is not defined".
    try {
      expect(() => {
        const { unmount } = render(<HighlightPicker editor={editor} />);
        unmount();
      }).not.toThrow();
    } finally {
      editor.destroy();
    }
  });
});
