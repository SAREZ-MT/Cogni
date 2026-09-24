import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEditorExtensions } from "./index";

// S6a (odd/tasks/app-shell-restyle.md), Editor directive: an empty block
// shows placeholder copy in Spanish, level-aware for headings, matching
// the Tiptap docs Notion-style editor. `@tiptap/extensions`' Placeholder
// decorates the empty node with a `data-placeholder` attribute and an
// `is-empty` class (default `showOnlyCurrent: true`, so this only fires
// while the cursor sits in that empty node — the default caret position
// in a freshly created single-node document).
function createHeadlessEditor(content: string) {
  return new Editor({
    extensions: createEditorExtensions(),
    content,
  });
}

describe("placeholder extension", () => {
  it("shows the default copy on an empty paragraph", () => {
    const editor = createHeadlessEditor("<p></p>");
    try {
      const paragraph = editor.view.dom.querySelector("p");
      expect(paragraph?.classList.contains("is-empty")).toBe(true);
      expect(paragraph?.getAttribute("data-placeholder")).toBe(
        "Escribe algo o presiona / para insertar un bloque",
      );
    } finally {
      editor.destroy();
    }
  });

  it("shows a level-aware copy on an empty heading", () => {
    const editor = createHeadlessEditor("<h1></h1>");
    try {
      const heading = editor.view.dom.querySelector("h1");
      expect(heading?.getAttribute("data-placeholder")).toBe("Título 1");
    } finally {
      editor.destroy();
    }
  });

  it("keeps the level-aware copy for heading 2 and 3", () => {
    const h2 = createHeadlessEditor("<h2></h2>");
    try {
      expect(
        h2.view.dom.querySelector("h2")?.getAttribute("data-placeholder"),
      ).toBe("Título 2");
    } finally {
      h2.destroy();
    }

    const h3 = createHeadlessEditor("<h3></h3>");
    try {
      expect(
        h3.view.dom.querySelector("h3")?.getAttribute("data-placeholder"),
      ).toBe("Título 3");
    } finally {
      h3.destroy();
    }
  });

  it("does not decorate a non-empty paragraph", () => {
    const editor = createHeadlessEditor("<p>hola</p>");
    try {
      const paragraph = editor.view.dom.querySelector("p");
      expect(paragraph?.hasAttribute("data-placeholder")).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});
