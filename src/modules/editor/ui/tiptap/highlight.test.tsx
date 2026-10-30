import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { CogniHighlight } from "./highlight-palette";

// specs/editor/spec.md, "Paleta de resaltado de Cogni y callouts", Scenario
// "Resaltado por nombre": choosing the "purple" highlight MUST store
// `{ color: "purple" }` in the JSON (never a hex code) and MUST render
// with the `purple`/`purple-fg` design tokens.
function createHeadlessEditor() {
  return new Editor({
    extensions: [StarterKit, CogniHighlight],
    content: "<p>hola</p>",
  });
}

describe("CogniHighlight", () => {
  it("stores the palette color name, not a hex code, when applied", () => {
    const editor = createHeadlessEditor();
    // destroy() must run even if an assertion throws, otherwise
    // ProseMirror's DOMObserver setTimeout flush can fire after Vitest has
    // torn down jsdom for this file, throwing "document is not defined".
    try {
      editor.commands.selectAll();
      const applied = editor.commands.setHighlight({ color: "purple" });

      expect(applied).toBe(true);
      const json = editor.getJSON();
      const paragraph = json.content?.[0];
      const mark = paragraph?.content?.[0]?.marks?.find(
        (m) => m.type === "highlight",
      );
      expect(mark?.attrs).toEqual({ color: "purple" });
    } finally {
      editor.destroy();
    }
  });

  // H7 (editor polish round 2): a marker-pen look painted from the
  // highlighter tokens in globals.css (`.editor-content
  // mark.cogni-highlighter[data-color=…]`); the text keeps the ink colour,
  // so the mark carries no pastel utility classes any more.
  it("renders the highlighter marker hook for the colour, never a hex value", () => {
    const editor = createHeadlessEditor();
    // See the destroy() note above: must run on every path.
    try {
      editor.commands.selectAll();
      editor.commands.setHighlight({ color: "purple" });

      const html = editor.getHTML();
      expect(html).toContain('data-color="purple"');
      expect(html).toContain('class="cogni-highlighter"');
      expect(html).not.toContain("bg-pastel");
      expect(html).not.toContain("text-pastel");
      expect(html).not.toMatch(/#[0-9a-f]{3,6}/i);
    } finally {
      editor.destroy();
    }
  });

  it("rejects an unknown color name instead of storing it", () => {
    const editor = createHeadlessEditor();
    // See the destroy() note above: must run on every path.
    try {
      editor.commands.selectAll();
      editor.commands.setHighlight({ color: "crimson" });

      const html = editor.getHTML();
      expect(html).not.toContain("data-color");
    } finally {
      editor.destroy();
    }
  });

  // PR5a review advisory: `parseHTML` MUST also reject an unrecognized
  // `data-color` value (pasted content or hand-authored HTML), not just
  // the `setHighlight` command path covered above.
  it("rejects an unknown color name when parsed from HTML", () => {
    const editor = createHeadlessEditor();
    // See the destroy() note above: must run on every path.
    try {
      editor.commands.setContent(
        '<p><mark data-color="crimson">hola</mark></p>',
      );

      const json = editor.getJSON();
      const mark = json.content?.[0]?.content?.[0]?.marks?.find(
        (m) => m.type === "highlight",
      );
      expect(mark?.attrs?.color ?? null).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});
