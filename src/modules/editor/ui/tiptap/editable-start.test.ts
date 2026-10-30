import { Editor } from "@tiptap/core";
import { AllSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { shouldShowBubbleToolbar } from "./bubble-toolbar";
import { withEditableStart } from "./editable-start";
import { createEditorExtensions } from "./extensions";

// H6-E1: a brand-new page is stored as `{ type: "doc", content: [] }`
// (notebooks' EMPTY_DOC). ProseMirror finds no text position in a doc
// without blocks, so its initial selection is an AllSelection; once the
// schema fills in the empty paragraph, that AllSelection spans it and is no
// longer empty, which floated the bubble toolbar over an untouched page.
describe("withEditableStart", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it("gives a document without blocks one empty paragraph", () => {
    expect(withEditableStart({ type: "doc", content: [] })).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    expect(withEditableStart({ type: "doc" })).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("returns a document that already has blocks unchanged", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
    };
    expect(withEditableStart(doc)).toBe(doc);
  });

  it("opens an empty page with a caret, so the bubble toolbar stays hidden", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: withEditableStart({ type: "doc", content: [] }),
    });
    const { state } = editor;

    expect(state.selection).not.toBeInstanceOf(AllSelection);
    expect(state.selection.empty).toBe(true);
    expect(
      shouldShowBubbleToolbar({
        editor,
        state,
        from: state.selection.from,
        to: state.selection.to,
      }),
    ).toBe(false);
  });
});
