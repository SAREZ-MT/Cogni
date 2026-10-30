// H8-6 (odd/tasks/phase-8-design-flows.md): code pasted INTO a code block
// keeps its structure — line breaks, indentation and blank lines exactly as
// pasted, from VS Code, a terminal or a web page. The clipboard's text/plain
// is inserted as literal text; when a source only offers text/html (a page
// with one <div> per line, a <pre>), the lines are rebuilt from the markup
// instead of letting ProseMirror parse them into paragraphs, which a code
// block flattens into one line. The block's language, and with it the
// syntax colouring, is never touched.
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "LI",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TR",
  "UL",
]);

const SKIPPED_TAGS = new Set(["HEAD", "META", "SCRIPT", "STYLE", "TITLE"]);

function htmlToCodeText(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  let out = "";
  const breakLine = () => {
    if (out !== "" && !out.endsWith("\n")) out += "\n";
  };

  function walk(node: Node, inPre: boolean) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      // Markup indentation between block tags ("</div>\n  <div>") is not
      // part of the code; inside a <pre> every character is.
      if (!inPre && text.includes("\n") && text.trim() === "") return;
      out += text;
      return;
    }
    if (!(node instanceof Element) || SKIPPED_TAGS.has(node.tagName)) return;
    if (node.tagName === "BR") {
      out += "\n";
      return;
    }
    const isBlock = BLOCK_TAGS.has(node.tagName);
    if (isBlock) breakLine();
    const childInPre = inPre || node.tagName === "PRE";
    for (const child of Array.from(node.childNodes)) walk(child, childInPre);
  }

  walk(body, false);
  return out;
}

// The literal text a paste into a code block inserts: text/plain when the
// clipboard has it, otherwise the lines rebuilt from text/html.
export function clipboardCodeText(text: string, html: string): string {
  const raw = text !== "" ? text : html !== "" ? htmlToCodeText(html) : "";
  return raw.replace(/\r\n?/g, "\n").replace(/ /g, " ");
}

export const codeBlockPastePluginKey = new PluginKey("cogniCodeBlockPaste");

// Only a selection that starts and ends inside the same code block is
// handled; every other paste keeps the editor's default behaviour.
export function createCodeBlockPastePlugin(
  editor: Editor,
  typeName: string,
): Plugin {
  return new Plugin({
    key: codeBlockPastePluginKey,
    props: {
      handlePaste(view, event) {
        const { $from, $to } = view.state.selection;
        if ($from.parent.type.name !== typeName) return false;
        if (!$from.sameParent($to)) return false;
        const data = event.clipboardData;
        if (!data || !editor.isEditable) return false;
        const text = clipboardCodeText(
          data.getData("text/plain"),
          data.getData("text/html"),
        );
        if (text === "") return false;
        const tr = view.state.tr
          .insertText(text, $from.pos, $to.pos)
          .scrollIntoView()
          .setMeta("paste", true);
        view.dispatch(tr);
        return true;
      },
    },
  });
}
