import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";

// specs/editor/spec.md, "Marcas de texto", Scenario "Marca por atajo": all
// five standard shortcuts must apply their mark. These come from
// @tiptap/starter-kit's bundled bold/italic/underline/strike/code
// extensions (confirmed against node_modules, no extra config needed).
function createHeadlessEditor() {
  return new Editor({
    extensions: createEditorExtensions(),
    content: "<p>hola</p>",
  });
}

function selectAllAndSerialize(applyMark: (editor: Editor) => boolean) {
  const editor = createHeadlessEditor();
  editor.commands.selectAll();
  const applied = applyMark(editor);
  const html = editor.getHTML();
  editor.destroy();
  return { applied, html };
}

describe("marks extensions", () => {
  it("Mod+B applies bold and serializes it", () => {
    const { applied, html } = selectAllAndSerialize((editor) =>
      editor.commands.toggleBold(),
    );
    expect(applied).toBe(true);
    expect(html).toContain("<strong>hola</strong>");
  });

  it("Mod+I applies italic", () => {
    const { applied, html } = selectAllAndSerialize((editor) =>
      editor.commands.toggleItalic(),
    );
    expect(applied).toBe(true);
    expect(html).toContain("<em>hola</em>");
  });

  it("Mod+U applies underline", () => {
    const { applied, html } = selectAllAndSerialize((editor) =>
      editor.commands.toggleUnderline(),
    );
    expect(applied).toBe(true);
    expect(html).toContain("<u>hola</u>");
  });

  it("Mod+Shift+S applies strike", () => {
    const { applied, html } = selectAllAndSerialize((editor) =>
      editor.commands.toggleStrike(),
    );
    expect(applied).toBe(true);
    expect(html).toContain("<s>hola</s>");
  });

  it("Mod+E applies inline code", () => {
    const { applied, html } = selectAllAndSerialize((editor) =>
      editor.commands.toggleCode(),
    );
    expect(applied).toBe(true);
    expect(html).toContain("<code>hola</code>");
  });
});
