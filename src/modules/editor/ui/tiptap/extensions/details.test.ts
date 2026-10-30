import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorExtensions } from ".";

// document-import T3: a speaker-notes block a reader expanded stays expanded
// after a reload (`persist: true` stores `open`).
const OPEN_DETAILS = {
  type: "doc",
  content: [
    {
      type: "details",
      attrs: { open: true },
      content: [
        {
          type: "detailsSummary",
          content: [{ type: "text", text: "Notas del orador" }],
        },
        {
          type: "detailsContent",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Speaker notes." }],
            },
          ],
        },
      ],
    },
  ],
};

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe("details", () => {
  let editor: Editor | undefined;
  let mount: HTMLElement | undefined;

  afterEach(() => {
    editor?.destroy();
    mount?.remove();
  });

  function createEditor() {
    mount = document.body.appendChild(document.createElement("div"));
    editor = new Editor({
      element: mount,
      extensions: createEditorExtensions(),
      content: OPEN_DETAILS,
    });
    return editor;
  }

  function detailsDom(current: Editor) {
    return current.view.dom.querySelector('[data-type="details"]');
  }

  it("renders a stored open block open", async () => {
    const current = createEditor();
    await nextTask();
    expect(detailsDom(current)).toHaveClass("is-open");
  });

  // CI run 41101107557 (pptx-import.spec.ts): the extension applies a stored
  // `open` in a setTimeout that toggles the class, so a node view update
  // landing first (it opens the block) made that toggle close it again.
  it("stays open when the block updates before the stored state is applied", async () => {
    const current = createEditor();
    // Typing in the notes (any change inside the block) updates its view.
    current.view.dispatch(current.state.tr.insertText("More. ", 21));
    await nextTask();
    expect(current.getText()).toContain("More. Speaker notes.");
    expect(detailsDom(current)).toHaveClass("is-open");
  });
});
