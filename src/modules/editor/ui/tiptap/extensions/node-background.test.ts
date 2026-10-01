import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";
import { NODE_BACKGROUND_TYPES } from "./node-background";

describe("NodeBackground", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  function create(content: string) {
    editor = new Editor({ extensions: createEditorExtensions(), content });
    return editor;
  }

  it("targets paragraphs, headings, the three list containers and blockquotes", () => {
    expect([...NODE_BACKGROUND_TYPES]).toEqual([
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "taskList",
      "blockquote",
    ]);
  });

  it("defaults to no background", () => {
    create("<p>hola</p>");
    expect(editor.state.doc.child(0).attrs.nodeBackground).toBeNull();
    expect(editor.view.dom.querySelector("[data-node-background]")).toBeNull();
  });

  it("renders a palette color as a data attribute plus its pastel utility class", () => {
    create("<p>hola</p>");
    editor
      .chain()
      .setNodeSelection(0)
      .updateAttributes("paragraph", { nodeBackground: "yellow" })
      .run();

    const block = editor.view.dom.querySelector("[data-node-background]");
    expect(block?.getAttribute("data-node-background")).toBe("yellow");
    expect(block?.classList.contains("bg-pastel-yellow")).toBe(true);
  });

  it("parses a palette color back from HTML", () => {
    create('<h2 data-node-background="mint">titulo</h2>');
    expect(editor.state.doc.child(0).attrs.nodeBackground).toBe("mint");
  });

  it("drops a value that is not in the palette when parsing and rendering", () => {
    create('<p data-node-background="hotpink">hola</p>');
    expect(editor.state.doc.child(0).attrs.nodeBackground).toBeNull();

    editor
      .chain()
      .setNodeSelection(0)
      .updateAttributes("paragraph", { nodeBackground: "hotpink" })
      .run();
    expect(editor.view.dom.querySelector("[data-node-background]")).toBeNull();
  });

  it("is supported on list containers and quotes too", () => {
    create("<ul><li>a</li></ul><blockquote><p>b</p></blockquote>");
    editor
      .chain()
      .setNodeSelection(0)
      .updateAttributes("bulletList", { nodeBackground: "blue" })
      .run();
    expect(editor.state.doc.child(0).attrs.nodeBackground).toBe("blue");
  });
});
