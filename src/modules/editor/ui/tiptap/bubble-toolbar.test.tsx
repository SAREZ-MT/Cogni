import { fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { BubbleToolbar, BubbleToolbarControls } from "./bubble-toolbar";
import { createEditorExtensions } from "./extensions";

// S6a (odd/tasks/app-shell-restyle.md), Editor directive: bubble toolbar on
// selection for inline formatting, matching the Tiptap docs Notion-style
// editor. Same headless-editor + direct-render pattern as
// highlight-picker.test.tsx: `BubbleToolbarControls` is plain and testable
// without floating-ui's layout math; `BubbleToolbar` (the real `BubbleMenu`
// wrapper) only gets a mount/unmount smoke test.
function createHeadlessEditor(content = "<p>hola cogni</p>") {
  const editor = new Editor({
    extensions: createEditorExtensions(),
    content,
  });
  editor.commands.selectAll();
  return editor;
}

describe("BubbleToolbarControls", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("exposes the container as a labeled toolbar", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    expect(
      screen.getByRole("toolbar", { name: "Formato de texto" }),
    ).toHaveAttribute("data-testid", "bubble-toolbar");
  });

  it("labels every mark button with its Spanish accessible name", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    for (const name of [
      "Negrita",
      "Cursiva",
      "Subrayado",
      "Tachado",
      "Código",
      "Enlace",
      "Resaltar",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("toggles bold on the selection and reflects it in aria-pressed", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    const boldButton = screen.getByRole("button", { name: "Negrita" });
    expect(boldButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(boldButton);

    expect(editor.isActive("bold")).toBe(true);
    expect(boldButton).toHaveAttribute("aria-pressed", "true");
  });

  it("applies an https link on Enter", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Enlace" }));
    const input = screen.getByTestId("bubble-toolbar-link-input");
    fireEvent.change(input, { target: { value: "https://cogni.app" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(editor.isActive("link", { href: "https://cogni.app" })).toBe(true);
    expect(
      screen.queryByTestId("bubble-toolbar-link-input"),
    ).not.toBeInTheDocument();
  });

  it("cancels the link input on Escape without applying anything", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Enlace" }));
    const input = screen.getByTestId("bubble-toolbar-link-input");
    fireEvent.change(input, { target: { value: "https://cogni.app" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(editor.isActive("link")).toBe(false);
    expect(
      screen.queryByTestId("bubble-toolbar-link-input"),
    ).not.toBeInTheDocument();
  });

  it("removes an existing link when the URL is cleared and Enter is pressed", () => {
    editor = createHeadlessEditor();
    editor.commands.setLink({ href: "https://cogni.app" });
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Enlace" }));
    const input = screen.getByTestId("bubble-toolbar-link-input");
    expect(input).toHaveValue("https://cogni.app");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(editor.isActive("link")).toBe(false);
  });

  it("opens the highlight palette and applies a color through it", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Resaltar" }));
    fireEvent.click(screen.getByTestId("highlight-swatch-purple"));

    const json = editor.getJSON();
    const mark = json.content?.[0]?.content?.[0]?.marks?.find(
      (m) => m.type === "highlight",
    );
    expect(mark?.attrs).toEqual({ color: "purple" });
  });
});

// The real `BubbleMenu` wrapper relies on floating-ui layout math that
// jsdom cannot fully emulate; this smoke test only confirms it mounts and
// unmounts without throwing when there is no selection (its `shouldShow`
// stays false).
describe("BubbleToolbar (smoke)", () => {
  it("mounts without throwing when there is no selection", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>hola</p>",
    });

    try {
      expect(() => {
        const { unmount } = render(<BubbleToolbar editor={editor} />);
        unmount();
      }).not.toThrow();
    } finally {
      editor.destroy();
    }
  });
});
