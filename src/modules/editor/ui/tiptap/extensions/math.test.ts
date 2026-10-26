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

  it("renders block math in display mode and inline math inline", () => {
    const content = {
      type: "doc",
      content: [
        { type: "blockMath", attrs: { latex: "\\sum_{i=1}^{n} x_i" } },
        {
          type: "paragraph",
          content: [{ type: "inlineMath", attrs: { latex: "a+b" } }],
        },
      ],
    };
    editor = new Editor({ extensions: createEditorExtensions(), content });

    const block = editor.view.dom.querySelector('[data-type="block-math"]');
    expect(block?.querySelector(".katex-display")).not.toBeNull();
    const paragraph = editor.view.dom.querySelector("p");
    expect(paragraph?.querySelector(".katex")).not.toBeNull();
    expect(paragraph?.querySelector(".katex-display")).toBeNull();
  });
});
