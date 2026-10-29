import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clipboardCodeText } from "./code-block-paste";
import { createEditorExtensions } from "./index";

const CODE = [
  "def fotosintesis(luz, agua):",
  "    if luz > 0:",
  "        return 'glucosa'",
  "",
  "    return None",
].join("\n");

// VS Code and most web pages put each line in its own <div> and keep the
// indentation as non-breaking spaces.
const VSCODE_HTML = `<meta charset="utf-8"><div style="white-space: pre;">${CODE.split(
  "\n",
)
  .map((line) => `<div>${line.replace(/ /g, "&nbsp;") || "<br>"}</div>`)
  .join("")}</div>`;

// A real paste event: jsdom has no ClipboardEvent, so the data is attached
// by hand. ProseMirror reads `clipboardData.getData` exactly like a browser.
function paste(editor: Editor, data: Record<string, string>) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: (type: string) => data[type] ?? "", types: [] },
  });
  editor.view.dom.dispatchEvent(event);
}

function codeBlocks(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "codeBlock") out.push(node.textContent);
  });
  return out;
}

// H8-6 (odd/tasks/phase-8-design-flows.md): code pasted INTO a code block
// keeps its line breaks, indentation and blank lines exactly as pasted.
describe("clipboardCodeText", () => {
  it("prefers text/plain and normalises Windows line endings", () => {
    expect(clipboardCodeText("a\r\n  b\r\n", "<p>x</p>")).toBe("a\n  b\n");
  });

  it("rebuilds the lines of a <div>-per-line HTML payload", () => {
    expect(clipboardCodeText("", VSCODE_HTML)).toBe(CODE);
  });

  it("keeps a <pre> payload verbatim", () => {
    expect(clipboardCodeText("", `<pre><code>${CODE}</code></pre>`)).toBe(CODE);
  });

  it("turns <br> into line breaks", () => {
    expect(clipboardCodeText("", "a<br>&nbsp;&nbsp;b")).toBe("a\n  b");
  });

  it("returns an empty string when nothing is on the clipboard", () => {
    expect(clipboardCodeText("", "")).toBe("");
  });
});

describe("pasting into a code block", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: '<pre><code class="language-python">x = 1</code></pre><p></p>',
    });
    // End of the code block's text.
    editor.commands.setTextSelection(6);
  });

  afterEach(() => {
    editor.destroy();
  });

  it("inserts multi-line plain text literally, indentation included", () => {
    paste(editor, { "text/plain": `\n${CODE}`, "text/html": VSCODE_HTML });

    expect(codeBlocks(editor)).toEqual([`x = 1\n${CODE}`]);
    expect(editor.state.doc.childCount).toBe(2);
  });

  it("keeps the lines of an HTML-only payload instead of splitting paragraphs", () => {
    paste(editor, { "text/html": VSCODE_HTML });

    expect(codeBlocks(editor)).toEqual([`x = 1${CODE}`]);
    expect(editor.state.doc.childCount).toBe(2);
  });

  it("replaces a selection inside the block and keeps the language", () => {
    editor.commands.setTextSelection({ from: 1, to: 6 });
    paste(editor, { "text/plain": CODE });

    expect(codeBlocks(editor)).toEqual([CODE]);
    let language: unknown;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "codeBlock") language = node.attrs.language;
    });
    expect(language).toBe("python");
  });

  it("leaves pastes outside a code block to the default handling", () => {
    editor.commands.setTextSelection(8);
    paste(editor, { "text/plain": "uno\n\ndos" });

    expect(codeBlocks(editor)).toEqual(["x = 1"]);
    expect(editor.state.doc.textContent).toContain("uno");
  });
});
