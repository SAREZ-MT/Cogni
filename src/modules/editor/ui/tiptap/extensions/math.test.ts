import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";

// Math has no insert entry point yet, but content that already contains it
// must keep rendering and round-trip unchanged.
describe("existing math content", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("keeps block and inline math in the document JSON", () => {
    const content = {
      type: "doc",
      content: [
        { type: "blockMath", attrs: { latex: "x^2" } },
        {
          type: "paragraph",
          content: [{ type: "inlineMath", attrs: { latex: "a+b" } }],
        },
      ],
    };
    editor = new Editor({ extensions: createEditorExtensions(), content });

    const json = editor.getJSON();
    expect(json.content?.[0]).toMatchObject({
      type: "blockMath",
      attrs: { latex: "x^2" },
    });
    expect(json.content?.[1].content?.[0]).toMatchObject({
      type: "inlineMath",
      attrs: { latex: "a+b" },
    });
    expect(editor.view.dom.querySelector(".katex")).not.toBeNull();
  });
});
