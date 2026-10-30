import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";
import {
  commitMath,
  MATH_EDIT_EVENT,
  type MathEditRequest,
  normalizeLatex,
} from "./math-editing";

// H7 (editor polish round 2): formulas can be written — `$…$` inline, the
// slash menu's "Ecuación" / "Ecuación en línea", and a LaTeX input with a
// live preview (math-editor.tsx) that also edits existing formulas.

function type(editor: Editor, text: string) {
  for (const char of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(editor.view, from, to, char, () => editor.state.tr),
    );
    if (!handled) editor.commands.insertContent(char);
  }
}

// getJSON()'s content is typed as node-or-text; math nodes carry attrs.
function attrsOf(node: object): Record<string, unknown> {
  return (node as { attrs?: Record<string, unknown> }).attrs ?? {};
}

function listen(editor: Editor) {
  const requests: MathEditRequest[] = [];
  editor.view.dom.addEventListener(MATH_EDIT_EVENT, (event) => {
    requests.push((event as CustomEvent<MathEditRequest>).detail);
  });
  return requests;
}

describe("normalizeLatex", () => {
  it.each([
    ["  x^2  ", "x^2"],
    ["$$\\frac{a}{b}$$", "\\frac{a}{b}"],
    ["$E = mc^2$", "E = mc^2"],
    ["\\[ \\int_0^1 x\\,dx \\]", "\\int_0^1 x\\,dx"],
    ["\\(a+b\\)", "a+b"],
    ["$$\n\\sum_{i=1}^n i\n$$", "\\sum_{i=1}^n i"],
    ["", ""],
    ["$$ $$", ""],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeLatex(input)).toBe(expected);
  });
});

describe("math editing", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("turns $…$ into inline math as it is typed", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p></p>",
    });
    editor.commands.focus("end");
    type(editor, "la energía $E=h\\nu$ fin");

    const paragraph = editor.getJSON().content?.[0];
    const math = paragraph?.content?.find((node) => node.type === "inlineMath");
    expect(math && attrsOf(math).latex).toBe("E=h\\nu");
    expect(editor.getText()).toContain("la energía");
  });

  it("does not take prices or a lone $ for math", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p></p>",
    });
    editor.commands.focus("end");
    type(editor, "cuesta $5 y luego $ 10 $");

    expect(JSON.stringify(editor.getJSON())).not.toContain("inlineMath");
  });

  it("inserts block math from a commit with no target, normalizing pasted delimiters", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p></p>",
    });
    editor.commands.focus("end");
    commitMath(editor, { kind: "block", pos: null, latex: "" }, "$$x^2$$");

    const blockMath = editor
      .getJSON()
      .content?.find((node) => node.type === "blockMath");
    expect(blockMath?.attrs?.latex).toBe("x^2");
    expect(editor.view.dom.querySelector(".katex-display")).not.toBeNull();
  });

  it("inserts inline math at the caret", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>a b</p>",
    });
    editor.commands.setTextSelection(2);
    commitMath(editor, { kind: "inline", pos: null, latex: "" }, "\\alpha");

    const latex = editor
      .getJSON()
      .content?.[0]?.content?.flatMap((node) =>
        node.type === "inlineMath" ? [attrsOf(node).latex] : [],
      );
    expect(latex).toEqual(["\\alpha"]);
  });

  it("updates an existing formula and removes it when emptied", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [
          { type: "blockMath", attrs: { latex: "x" } },
          { type: "paragraph" },
        ],
      },
    });
    commitMath(editor, { kind: "block", pos: 0, latex: "x" }, "y^2");
    expect(editor.getJSON().content?.[0]?.attrs?.latex).toBe("y^2");

    commitMath(editor, { kind: "block", pos: 0, latex: "y^2" }, "   ");
    expect(JSON.stringify(editor.getJSON())).not.toContain("blockMath");
  });

  it("never inserts an empty formula", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p></p>",
    });
    editor.commands.focus("end");
    expect(
      commitMath(editor, { kind: "block", pos: null, latex: "" }, "  "),
    ).toBe(false);
    expect(JSON.stringify(editor.getJSON())).not.toContain("blockMath");
  });

  it("asks to edit a formula when Enter is pressed on a selected one", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [
          { type: "blockMath", attrs: { latex: "x^2" } },
          { type: "paragraph" },
        ],
      },
    });
    const requests = listen(editor);
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)),
    );
    const enter = new KeyboardEvent("keydown", { key: "Enter" });
    editor.view.someProp("handleKeyDown", (handler) =>
      handler(editor.view, enter),
    );

    expect(requests).toEqual([{ kind: "block", pos: 0, latex: "x^2" }]);
  });

  it("asks to edit a formula when it is clicked", () => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "a " },
              { type: "inlineMath", attrs: { latex: "b" } },
            ],
          },
        ],
      },
    });
    const requests = listen(editor);
    const node = editor.state.doc.nodeAt(3);
    const handled = editor.view.someProp("handleClickOn", (handler) =>
      handler(editor.view, 3, node as never, 3, new MouseEvent("click"), true),
    );

    expect(handled).toBe(true);
    expect(requests).toEqual([{ kind: "inline", pos: 3, latex: "b" }]);
  });
});
