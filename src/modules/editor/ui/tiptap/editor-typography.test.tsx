import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FakeSavePagePort } from "../../application/testing/fake-save-page-port";
import type { TiptapDoc } from "../../domain/save-page-port";
import { Editor } from "./editor";

// T13b (design fidelity, docs/design-system/screenshots/editor.png and
// preview/type-scale.html): imported and hand-written content must render
// through real semantic elements (h1-h3, p, ul/ol, task list, blockquote,
// code block, hr, image, highlight mark) styled by `.editor-content` in
// globals.css, not a generic `@tailwindcss/typography` `.prose` look.
// This asserts DOM structure/classes only (jsdom does not load an external
// stylesheet, so computed styles from globals.css are not observable
// here); the parent's browser pass compares actual rendering against
// editor.png.
function docWithAllBlockFamilies(): TiptapDoc {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Título del capítulo" }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Sección" }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Subsección" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Texto normal con " },
          {
            type: "text",
            text: "resaltado",
            marks: [{ type: "highlight", attrs: { color: "pink" } }],
          },
          { type: "text", text: "." },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "elemento con viñeta" }],
              },
            ],
          },
        ],
      },
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "elemento numerado" }],
              },
            ],
          },
        ],
      },
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "tarea hecha" }],
              },
            ],
          },
        ],
      },
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "una cita" }] },
        ],
      },
      {
        type: "callout",
        attrs: { kind: "idea" },
        content: [
          { type: "paragraph", content: [{ type: "text", text: "una idea" }] },
        ],
      },
      {
        type: "codeBlock",
        attrs: { language: "javascript" },
        content: [{ type: "text", text: "const x = 1;" }],
      },
      { type: "horizontalRule" },
      { type: "image", attrs: { assetId: null } },
    ],
  } as unknown as TiptapDoc;
}

describe("Editor typography (T13b)", () => {
  it("renders every block family through real semantic elements under .editor-content, not a generic .prose wrapper", async () => {
    const doc = docWithAllBlockFamilies();
    const port = new FakeSavePagePort({ content: doc, version: 1 });

    render(
      <Editor
        pageId="page-1"
        initialContent={doc}
        initialVersion={1}
        port={port}
      />,
    );

    const content = await screen.findByTestId("editor-content");
    expect(content.className).toContain("editor-content");
    expect(content.className).not.toContain("prose");

    // Headings: real h1/h2/h3, not flattened paragraphs.
    expect(content.querySelector("h1")).toHaveTextContent(
      "Título del capítulo",
    );
    expect(content.querySelector("h2")).toHaveTextContent("Sección");
    expect(content.querySelector("h3")).toHaveTextContent("Subsección");

    // Paragraph + highlight mark (palette class, never inline style/hex).
    const mark = content.querySelector("mark");
    expect(mark).toHaveTextContent("resaltado");
    expect(mark?.className).toContain("bg-pastel-pink");

    // Lists.
    expect(
      content.querySelector("ul:not([data-type='taskList']) li"),
    ).toHaveTextContent("elemento con viñeta");
    expect(content.querySelector("ol li")).toHaveTextContent(
      "elemento numerado",
    );

    // Task list: dedicated list type, checked state reflected in the DOM.
    const taskItem = content.querySelector('ul[data-type="taskList"] li');
    expect(taskItem).toHaveAttribute("data-checked", "true");
    expect(taskItem).toHaveTextContent("tarea hecha");

    // Blockquote (native quote, distinct from the callout node view).
    expect(content.querySelector("blockquote")).toHaveTextContent("una cita");

    // Callout node view (own component, already covered by callout.test.tsx;
    // asserted here only for block-family completeness).
    expect(await screen.findByTestId("callout")).toHaveTextContent("una idea");

    // Code block node view.
    expect(
      content.querySelector('[data-testid="code-block"] pre code'),
    ).toHaveTextContent("const x = 1;");

    // Divider.
    expect(content.querySelector("hr")).toBeInTheDocument();

    // Image node view (no port/assetId here -> placeholder picker state).
    expect(
      await screen.findByTestId("image-node-placeholder"),
    ).toBeInTheDocument();
  });
});
