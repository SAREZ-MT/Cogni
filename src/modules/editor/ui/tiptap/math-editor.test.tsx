import { act, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorExtensions } from "./extensions";
import { requestMathEdit } from "./extensions/math-editing";
import { MathEditor } from "./math-editor";

// H7 (editor polish round 2): the LaTeX input with a live preview that the
// slash menu's "Ecuación" entries, a click or Enter on a formula open.
function createEditor(content: unknown = "<p></p>") {
  const editor = new Editor({
    extensions: createEditorExtensions(),
    content: content as string,
  });
  editor.commands.focus("end");
  return editor;
}

describe("MathEditor", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("stays closed until a formula is requested", () => {
    editor = createEditor();
    render(<MathEditor editor={editor} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("previews pasted LaTeX live and inserts it as block math on Enter", () => {
    editor = createEditor();
    render(<MathEditor editor={editor} />);
    act(() => requestMathEdit(editor, { kind: "block", pos: null, latex: "" }));

    const dialog = screen.getByRole("dialog", { name: "Ecuación" });
    const input = screen.getByRole("textbox", { name: "LaTeX" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "$$\\frac{1}{3}$$" } });
    expect(
      dialog.querySelector("[data-testid='math-preview'] .katex"),
    ).not.toBeNull();

    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.queryByRole("dialog")).toBeNull();
    const blockMath = editor
      .getJSON()
      .content?.find((node) => node.type === "blockMath");
    expect(blockMath?.attrs?.latex).toBe("\\frac{1}{3}");
  });

  it("keeps Shift+Enter as a new line inside the input", () => {
    editor = createEditor();
    render(<MathEditor editor={editor} />);
    act(() => requestMathEdit(editor, { kind: "block", pos: null, latex: "" }));
    const input = screen.getByRole("textbox", { name: "LaTeX" });
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cancels on Escape without inserting anything", () => {
    editor = createEditor();
    render(<MathEditor editor={editor} />);
    act(() =>
      requestMathEdit(editor, { kind: "inline", pos: null, latex: "" }),
    );
    const input = screen.getByRole("textbox", { name: "LaTeX" });
    fireEvent.change(input, { target: { value: "x^2" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(JSON.stringify(editor.getJSON())).not.toContain("Math");
  });

  it("edits an existing formula from its current LaTeX", () => {
    editor = createEditor({
      type: "doc",
      content: [
        { type: "blockMath", attrs: { latex: "x" } },
        { type: "paragraph" },
      ],
    });
    render(<MathEditor editor={editor} />);
    act(() => requestMathEdit(editor, { kind: "block", pos: 0, latex: "x" }));

    const input = screen.getByRole("textbox", { name: "LaTeX" });
    expect(input).toHaveValue("x");
    fireEvent.change(input, { target: { value: "y^2" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(editor.getJSON().content?.[0]?.attrs?.latex).toBe("y^2");
  });
});
