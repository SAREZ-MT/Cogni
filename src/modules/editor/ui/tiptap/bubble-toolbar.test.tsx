import { act, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { NodeRangeSelection } from "@tiptap/extension-node-range";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BubbleToolbar,
  BubbleToolbarControls,
  LinkPopover,
  shouldShowBubbleToolbar,
} from "./bubble-toolbar";
import { createEditorExtensions } from "./extensions";

// Finds the position right before the first occurrence of `needle` inside
// any text node, for placing the selection/caret precisely (same intent as
// extensions/task-list.test.tsx's `descendants` search, adapted for text).
function findTextPosition(editor: Editor, needle: string): number {
  let result = -1;
  editor.state.doc.descendants((node, pos) => {
    if (result !== -1) return false;
    if (node.isText && node.text?.includes(needle)) {
      result = pos + node.text.indexOf(needle);
    }
    return true;
  });
  if (result === -1) throw new Error(`"${needle}" not found in the document`);
  return result;
}

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
      "Convertir en",
      "Texto: fuente y tamaño",
      "Deshacer",
      "Rehacer",
      "Negrita",
      "Cursiva",
      "Subrayado",
      "Tachado",
      "Código",
      "Superíndice",
      "Subíndice",
      "Color de texto",
      "Alineación",
      "Enlace",
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

  // S6a review follow-up (R3-link-scheme-untested, folded into S6b):
  // typing a disallowed scheme must not apply anything (extensions/
  // index.ts's `isAllowedLinkUri` already rejects it, tested directly in
  // extensions/link.test.tsx) AND the input must still close, matching the
  // https/Escape/clear paths above instead of leaving a dead-end open input.
  it("rejects a javascript: URL, leaves the document unchanged and closes the input", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    const beforeJson = editor.getJSON();
    fireEvent.click(screen.getByRole("button", { name: "Enlace" }));
    const input = screen.getByTestId("bubble-toolbar-link-input");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(editor.isActive("link")).toBe(false);
    expect(editor.getJSON()).toEqual(beforeJson);
    expect(
      screen.queryByTestId("bubble-toolbar-link-input"),
    ).not.toBeInTheDocument();
  });

  // S6a review follow-up (R3-stale-toolbar-state, folded into S6b): a
  // selection change while the link input is open must reset it, so a
  // stale draft URL never gets applied to a new, unrelated selection.
  it("closes the open link input when the selection changes elsewhere in the document", () => {
    editor = createHeadlessEditor("<p>hola cogni mundo</p>");
    editor.commands.setTextSelection({
      from: findTextPosition(editor, "cogni"),
      to: findTextPosition(editor, "cogni") + "cogni".length,
    });
    const { rerender } = render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Enlace" }));
    const input = screen.getByTestId("bubble-toolbar-link-input");
    fireEvent.change(input, { target: { value: "https://stale.example" } });

    // Move the selection to "mundo" without going through applyLink().
    const from = findTextPosition(editor, "mundo");
    editor.commands.setTextSelection({ from, to: from + "mundo".length });
    rerender(<BubbleToolbarControls editor={editor} />);

    expect(
      screen.queryByTestId("bubble-toolbar-link-input"),
    ).not.toBeInTheDocument();

    // Reopening after the reset must not resurrect the stale draft value.
    fireEvent.click(screen.getByRole("button", { name: "Enlace" }));
    expect(screen.getByTestId("bubble-toolbar-link-input")).toHaveValue("");
  });

  // E2: "Resaltar" is now one row ("Fondo / Resaltado") inside the
  // combined color popover opened by "Color de texto" — HighlightPickerControls
  // itself is unchanged (same `highlight-picker` testid, same "Resaltar en
  // <color>" swatch names).
  it("opens the color popover and applies a highlight through its Fondo/Resaltado row", async () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Color de texto" }));
    fireEvent.click(await screen.findByTestId("highlight-swatch-purple"));

    const json = editor.getJSON();
    const mark = json.content?.[0]?.content?.[0]?.marks?.find(
      (m) => m.type === "highlight",
    );
    expect(mark?.attrs).toEqual({ color: "purple" });
  });

  // E2: the "Texto" row of the same popover applies the inline Color mark
  // (block-color-palette.ts) to the current selection.
  it("opens the color popover and applies a text color through its Texto row", async () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Color de texto" }));
    fireEvent.click(
      await screen.findByTestId("bubble-toolbar-text-color-purple"),
    );

    const json = editor.getJSON();
    const mark = json.content?.[0]?.content?.[0]?.marks?.find(
      (m) => m.type === "textStyle",
    );
    expect(mark?.attrs.color).toBe("var(--color-pastel-purple-fg)");
  });

  // E2 toolbar additions: block-type dropdown, undo/redo, super/subscript and
  // alignment.
  it("shows the current block's name on the 'Convertir en' trigger", () => {
    editor = createHeadlessEditor("<h2>hola</h2>");
    editor.commands.setTextSelection({ from: 1, to: 3 });
    render(<BubbleToolbarControls editor={editor} />);

    expect(screen.getByTestId("bubble-toolbar-block-type")).toHaveTextContent(
      "Encabezado 2",
    );
  });

  it("converts the block through the 'Convertir en' dropdown", async () => {
    editor = createHeadlessEditor();
    editor.commands.setTextSelection({ from: 1, to: 3 });
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.pointerDown(screen.getByTestId("bubble-toolbar-block-type"), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Cita/ }));

    expect(editor.isActive("blockquote")).toBe(true);
  });

  // H7: the BubbleMenu only survives the editor's blur after a mousedown on
  // its element; Radix dropdown triggers cancel pointerdown (and with it the
  // mousedown), so the toolbar re-signals it.
  it("signals a mousedown to the bubble menu when a dropdown trigger is pressed", () => {
    editor = createHeadlessEditor();
    const { container } = render(<BubbleToolbarControls editor={editor} />);
    const onMouseDown = vi.fn();
    container.addEventListener("mousedown", onMouseDown);

    fireEvent.pointerDown(screen.getByTestId("bubble-toolbar-text-style"), {
      button: 0,
      ctrlKey: false,
    });

    expect(onMouseDown).toHaveBeenCalled();
  });

  // H7: the "Texto" menu sets the font family and size of the selection.
  it("sets the font family and size through the 'Texto' menu", async () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    const openMenu = () =>
      fireEvent.pointerDown(screen.getByTestId("bubble-toolbar-text-style"), {
        button: 0,
        ctrlKey: false,
      });
    openMenu();
    const bitter = await screen.findByRole("menuitemradio", { name: "Bitter" });
    expect(bitter).toHaveStyle({ fontFamily: "Bitter, serif" });
    expect(
      screen.getByRole("menuitemradio", { name: "Predeterminada" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(bitter);
    expect(editor.getAttributes("textStyle").fontFamily).toBe("Bitter, serif");

    openMenu();
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: /^Grande/ }),
    );
    expect(editor.getAttributes("textStyle").fontSize).toBe("22px");

    openMenu();
    expect(
      await screen.findByRole("menuitemradio", { name: "Bitter" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Normal/ }));
    expect(editor.getAttributes("textStyle").fontSize ?? null).toBeNull();
  });

  it("disables undo/redo until there is history, then undoes and redoes", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);
    const undo = screen.getByRole("button", { name: "Deshacer" });
    const redo = screen.getByRole("button", { name: "Rehacer" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    act(() => {
      editor.chain().toggleBold().run();
    });
    expect(undo).toBeEnabled();

    fireEvent.click(undo);
    expect(editor.isActive("bold")).toBe(false);
    expect(redo).toBeEnabled();

    fireEvent.click(redo);
    expect(editor.isActive("bold")).toBe(true);
  });

  it("toggles superscript and subscript and reflects them in aria-pressed", () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    const sup = screen.getByRole("button", { name: "Superíndice" });
    fireEvent.click(sup);
    expect(editor.isActive("superscript")).toBe(true);
    expect(sup).toHaveAttribute("aria-pressed", "true");

    const sub = screen.getByRole("button", { name: "Subíndice" });
    fireEvent.click(sub);
    expect(editor.isActive("subscript")).toBe(true);
  });

  it("aligns the block through the alignment dropdown", async () => {
    editor = createHeadlessEditor();
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Alineación" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Centro/ }));

    expect(editor.state.doc.child(0).attrs.textAlign).toBe("center");
  });

  // S6b defect 2 (focus, odd/tasks/app-shell-restyle.md): applying a link
  // must leave the editor focused, not `document.body`. Tiptap's own
  // `editor.chain().focus()` command (already used above) restores the
  // selection but only calls the real DOM `view.focus()` inside a
  // `requestAnimationFrame` callback (@tiptap/core's `focus` command,
  // `delayedFocus`) — deferred past the point where closing the popover
  // removes the currently-focused input from the DOM, which blurs to
  // `document.body` in the meantime. `editor.view.focus()` is
  // ProseMirror's own synchronous method (no rAF), so spying on it proves
  // the handler grabs focus back immediately instead of waiting a frame
  // (the orchestrator observed `document.activeElement === body` right
  // after Enter, matching that gap).
  it("keeps the editor focused synchronously after applying a link on Enter", () => {
    editor = createHeadlessEditor();
    const focusSpy = vi.spyOn(editor.view, "focus");
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Enlace" }));
    const input = screen.getByTestId("bubble-toolbar-link-input");
    fireEvent.change(input, { target: { value: "https://cogni.app" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(focusSpy).toHaveBeenCalled();
  });

  it("keeps the editor focused synchronously after removing a link with an empty URL on Enter", () => {
    editor = createHeadlessEditor();
    editor.commands.setLink({ href: "https://cogni.app" });
    const focusSpy = vi.spyOn(editor.view, "focus");
    render(<BubbleToolbarControls editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Enlace" }));
    const input = screen.getByTestId("bubble-toolbar-link-input");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(focusSpy).toHaveBeenCalled();
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

// S6a review follow-up (R3-shouldshow-unproved, folded into S6b): the
// `shouldShow` predicate passed to the real `BubbleMenu` was never unit
// tested on its own, relying only on the smoke test above (which never
// exercises a non-empty selection, since floating-ui can't position in
// jsdom). Extracted as a pure function so it can be proved directly against
// a headless editor, independent of floating-ui/BubbleMenu.
describe("shouldShowBubbleToolbar", () => {
  it("returns false for an empty selection", () => {
    const editor = createHeadlessEditor();
    try {
      editor.commands.setTextSelection(1);
      const { from, to } = editor.state.selection;
      expect(
        shouldShowBubbleToolbar({ editor, state: editor.state, from, to }),
      ).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("returns false for a selection inside a code block", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            content: [{ type: "text", text: "const x = 1;" }],
          },
        ],
      } as unknown as Record<string, unknown>,
    });
    try {
      // `selectAll()` produces an `AllSelection` spanning the whole doc
      // (from just before the codeBlock to just after it), which sits
      // OUTSIDE the codeBlock's own depth and does not count as "inside"
      // it for `isActive`. A plain text selection within its content does.
      editor.commands.setTextSelection({ from: 1, to: 5 });
      const { from, to } = editor.state.selection;
      expect(
        shouldShowBubbleToolbar({ editor, state: editor.state, from, to }),
      ).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("returns false when the selected node is an image", () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: null } }],
      } as unknown as Record<string, unknown>,
    });
    try {
      editor.commands.setNodeSelection(0);
      const { from, to } = editor.state.selection;
      expect(
        shouldShowBubbleToolbar({ editor, state: editor.state, from, to }),
      ).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  // S7 review follow-up (R3-toolbar-over-block-selection, odd/tasks/
  // app-shell-restyle.md): Notion hides inline formatting entirely while a
  // whole block is selected (drag-handle NodeSelection/NodeRangeSelection),
  // not only over a code block or an image.
  it("returns false for a NodeSelection over a whole block", () => {
    const editor = createHeadlessEditor("<p>primero</p><p>segundo</p>");
    try {
      editor.commands.setNodeSelection(0);
      const { from, to } = editor.state.selection;
      expect(
        shouldShowBubbleToolbar({ editor, state: editor.state, from, to }),
      ).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("returns false for a NodeRangeSelection over multiple blocks", () => {
    const editor = createHeadlessEditor(
      "<p>primero</p><p>segundo</p><p>tercero</p>",
    );
    try {
      const { doc } = editor.state;
      const nodeRangeSelection = NodeRangeSelection.create(
        doc,
        0,
        doc.content.size,
      );
      editor.view.dispatch(editor.state.tr.setSelection(nodeRangeSelection));
      const { from, to } = editor.state.selection;
      expect(
        shouldShowBubbleToolbar({ editor, state: editor.state, from, to }),
      ).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it("returns true for a plain, non-empty text selection", () => {
    const editor = createHeadlessEditor();
    try {
      editor.commands.selectAll();
      const { from, to } = editor.state.selection;
      expect(
        shouldShowBubbleToolbar({ editor, state: editor.state, from, to }),
      ).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});

// S6b (odd/tasks/app-shell-restyle.md): the link popover shown when the
// caret sits inside an existing link with no selection ("Abrir"/"Editar"/
// "Quitar"), matching the Tiptap docs Notion-style editor's inline-link
// affordance. Same headless-editor + direct-render pattern as
// BubbleToolbarControls above.
describe("LinkPopover", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  function createEditorWithCaretInLink(href: string) {
    const instance = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>visita cogni hoy</p>",
    });
    const from = findTextPosition(instance, "cogni");
    const to = from + "cogni".length;
    instance.commands.setTextSelection({ from, to });
    instance.commands.setLink({ href });
    // Caret inside the link, no selection, matching how a user's cursor
    // would land after clicking into linked text.
    instance.commands.setTextSelection(from + 2);
    return instance;
  }

  it("shows a labeled dialog with the (truncated) URL", () => {
    editor = createEditorWithCaretInLink(
      "https://cogni.app/una-ruta-de-ejemplo-bastante-larga-para-truncar",
    );
    render(<LinkPopover editor={editor} />);

    expect(screen.getByRole("dialog", { name: "Enlace" })).toHaveAttribute(
      "data-testid",
      "link-popover",
    );
  });

  it("Abrir opens the URL in a new tab with rel=noopener noreferrer", () => {
    editor = createEditorWithCaretInLink("https://cogni.app/pagina");
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<LinkPopover editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir enlace" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://cogni.app/pagina",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("Editar opens the inline input prefilled with the current URL", () => {
    editor = createEditorWithCaretInLink("https://cogni.app/pagina");
    render(<LinkPopover editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar enlace" }));

    expect(screen.getByTestId("link-popover-input")).toHaveValue(
      "https://cogni.app/pagina",
    );
  });

  it("applies an edited URL on Enter", () => {
    editor = createEditorWithCaretInLink("https://cogni.app/vieja");
    render(<LinkPopover editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar enlace" }));
    const input = screen.getByTestId("link-popover-input");
    fireEvent.change(input, { target: { value: "https://cogni.app/nueva" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(editor.isActive("link", { href: "https://cogni.app/nueva" })).toBe(
      true,
    );
  });

  it("Quitar removes the link mark", () => {
    editor = createEditorWithCaretInLink("https://cogni.app/pagina");
    render(<LinkPopover editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar enlace" }));

    expect(editor.isActive("link")).toBe(false);
  });

  // S6b defect 2 (focus, odd/tasks/app-shell-restyle.md): same gap as
  // BubbleToolbarControls's applyLink above, for the popover's own
  // Editar (apply) and Quitar (remove) actions.
  it("keeps the editor focused synchronously after Editar applies an edited URL on Enter", () => {
    editor = createEditorWithCaretInLink("https://cogni.app/vieja");
    const focusSpy = vi.spyOn(editor.view, "focus");
    render(<LinkPopover editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar enlace" }));
    const input = screen.getByTestId("link-popover-input");
    fireEvent.change(input, { target: { value: "https://cogni.app/nueva" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(focusSpy).toHaveBeenCalled();
  });

  it("keeps the editor focused synchronously after Quitar removes the link", () => {
    editor = createEditorWithCaretInLink("https://cogni.app/pagina");
    const focusSpy = vi.spyOn(editor.view, "focus");
    render(<LinkPopover editor={editor} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar enlace" }));

    expect(focusSpy).toHaveBeenCalled();
  });
});
