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
    editor.commands.selectAll();
    const applied = editor.commands.setHighlight({ color: "purple" });

    expect(applied).toBe(true);
    const json = editor.getJSON();
    const paragraph = json.content?.[0];
    const mark = paragraph?.content?.[0]?.marks?.find(
      (m) => m.type === "highlight",
    );
    expect(mark?.attrs).toEqual({ color: "purple" });

    editor.destroy();
  });

  it("renders the purple/purple-fg design tokens, never a hex value", () => {
    const editor = createHeadlessEditor();
    editor.commands.selectAll();
    editor.commands.setHighlight({ color: "purple" });

    const html = editor.getHTML();
    expect(html).toContain("bg-pastel-purple");
    expect(html).toContain("text-pastel-purple-fg");
    expect(html).not.toMatch(/#[0-9a-f]{3,6}/i);

    editor.destroy();
  });

  it("rejects an unknown color name instead of storing it", () => {
    const editor = createHeadlessEditor();
    editor.commands.selectAll();
    editor.commands.setHighlight({ color: "crimson" });

    const html = editor.getHTML();
    expect(html).not.toContain("data-color");

    editor.destroy();
  });
});
