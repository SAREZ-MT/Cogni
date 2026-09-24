import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockHandle } from "./block-handle";
import * as blockSelection from "./block-selection";
import { createEditorExtensions } from "./extensions";

// S6b (odd/tasks/app-shell-restyle.md), Editor directive: per-block "⋮⋮"
// drag handle + "+" insert in the left gutter, matching the Tiptap docs
// Notion-style editor. The real `@tiptap/extension-drag-handle-react`
// `DragHandle` renders via `ReactDOM.createPortal` into a wrapper it
// appends to `document.body` and toggles with `visibility` based on
// floating-ui layout math jsdom does not implement, so this mock keeps its
// public contract (render `children`, call `onNodeChange({ node, editor,
// pos })`, and expose `onElementDragEnd` so the defect-1 fix below can be
// exercised) testable without that layout math — this file only asserts
// `BlockHandle`'s own behaviour (the two controls, the "+" action, the
// drag-end wiring), never the drag-and-drop gesture itself (a browser-only
// concern, flagged for the orchestrator's visual pass).
let capturedOnElementDragEnd: ((e: DragEvent) => void) | undefined;

vi.mock("@tiptap/extension-drag-handle-react", () => ({
  default: ({
    editor,
    onNodeChange,
    onElementDragEnd,
    children,
  }: {
    editor: Editor;
    onNodeChange?: (data: {
      node: ReturnType<Editor["state"]["doc"]["nodeAt"]>;
      editor: Editor;
      pos: number;
    }) => void;
    onElementDragEnd?: (e: DragEvent) => void;
    children: React.ReactNode;
  }) => {
    const node = editor.state.doc.firstChild;
    onNodeChange?.({ node, editor, pos: 0 });
    capturedOnElementDragEnd = onElementDragEnd;
    return <div data-testid="drag-handle-mock">{children}</div>;
  },
}));

// S6b defect 1 (odd/tasks/app-shell-restyle.md): `collapseBlockSelection`
// itself is proved directly in block-selection.test.tsx; here we only prove
// `BlockHandle` wires it into the drag-end callback, deferred so it runs
// after @tiptap/extension-drag-handle's own drop handling has settled.
vi.mock("./block-selection", () => ({
  collapseBlockSelection: vi.fn(),
}));

function createHeadlessEditor(content = "<p>hola cogni</p>") {
  return new Editor({ extensions: createEditorExtensions(), content });
}

describe("BlockHandle", () => {
  let editor: Editor;

  beforeEach(() => {
    capturedOnElementDragEnd = undefined;
    vi.useFakeTimers();
  });

  afterEach(() => {
    editor?.destroy();
    vi.useRealTimers();
  });

  it("renders the insert and drag controls with their Spanish accessible names", () => {
    editor = createHeadlessEditor();
    render(<BlockHandle editor={editor} />);

    expect(
      screen.getByRole("button", { name: "Insertar bloque" }),
    ).toHaveAttribute("data-testid", "block-insert");
    // E2: the same grip now both drags AND opens the block context menu
    // on a plain click (block-context-menu.tsx) — "Opciones del bloque"
    // reflects both, not just the drag gesture.
    expect(
      screen.getByRole("button", { name: "Opciones del bloque" }),
    ).toHaveAttribute("data-testid", "block-drag-handle");
  });

  it("hands the persisted-id predicate to its context menu, which gates Copiar enlace on it", async () => {
    vi.useRealTimers();
    editor = createHeadlessEditor();
    await waitFor(() =>
      expect(editor.state.doc.firstChild?.attrs.blockId).toEqual(
        expect.any(String),
      ),
    );
    const id = editor.state.doc.firstChild?.attrs.blockId as string;
    const user = userEvent.setup();
    const { unmount } = render(
      <BlockHandle editor={editor} isBlockIdPersisted={(c) => c === id} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Opciones del bloque" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: /Copiar enlace/ }),
    ).toBeVisible();
    unmount();

    render(<BlockHandle editor={editor} />);
    await user.click(
      screen.getByRole("button", { name: "Opciones del bloque" }),
    );
    await screen.findByRole("menuitem", { name: /Duplicar/ });
    expect(
      screen.queryByRole("menuitem", { name: /Copiar enlace/ }),
    ).toBeNull();
  });

  it("gives the drag control a grab cursor", () => {
    editor = createHeadlessEditor();
    render(<BlockHandle editor={editor} />);

    expect(screen.getByTestId("block-drag-handle").className).toMatch(
      /cursor-grab/,
    );
  });

  // S7 review follow-up (R3-slash-open-unasserted, odd/tasks/app-shell-
  // restyle.md): the previous version of this case only proved the "/"
  // character landed in the document, never that the slash menu (command-
  // menu.tsx, mounted by slash-command.tsx's Suggestion plugin) actually
  // opened in response — a regression that silently broke opening the menu
  // from "+" would have passed unnoticed.
  it("clicking + inserts an empty paragraph after the tracked block and opens the slash command menu", async () => {
    // This test needs the suggestion popup's own real positioning/async
    // mount to actually settle (unlike the drag-end deferral tests above,
    // which drive `requestAnimationFrame` by hand), so it opts out of this
    // describe block's shared fake timers.
    vi.useRealTimers();
    editor = createHeadlessEditor("<p>hola cogni</p>");
    render(<BlockHandle editor={editor} />);

    fireEvent.click(screen.getByTestId("block-insert"));

    const json = editor.getJSON();
    expect(json.content).toHaveLength(2);
    const firstText = json.content?.[0]?.content?.[0] as
      | { text?: string }
      | undefined;
    expect(firstText?.text).toBe("hola cogni");
    expect(json.content?.[1]?.type).toBe("paragraph");
    const secondText = json.content?.[1]?.content?.[0] as
      | { text?: string }
      | undefined;
    expect(secondText?.text).toBe("/");

    expect(await screen.findByTestId("command-menu")).toBeInTheDocument();
  });

  // S7 review follow-up (R3-stale-hovered-block-position, odd/tasks/
  // app-shell-restyle.md): `onNodeChange` only fires on pointer moves over
  // the gutter, so `hoveredRef` can point at a position the document no
  // longer agrees with by the time "+" is actually clicked (a remote
  // reconciliation, or the user typing elsewhere first). Re-resolving from
  // the CURRENT doc and refusing to insert when the node at that position
  // no longer matches avoids inserting mid an unrelated block.
  it("does not insert when the document changed between hover and click (stale hovered position)", () => {
    editor = createHeadlessEditor("<p>primero</p><p>segundo</p>");
    render(<BlockHandle editor={editor} />);
    // The drag-handle mock's onNodeChange captured the paragraph "primero"
    // at pos 0 on mount. Replace it with a different node type at the same
    // position, simulating a doc change the hover never saw.
    editor.commands.setContent(
      {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "primero" }],
          },
          { type: "paragraph", content: [{ type: "text", text: "segundo" }] },
        ],
      } as unknown as Record<string, unknown>,
      { emitUpdate: false },
    );
    const beforeJson = editor.getJSON();

    fireEvent.click(screen.getByTestId("block-insert"));

    expect(editor.getJSON()).toEqual(beforeJson);
  });

  // S6b defect 1 (data loss, odd/tasks/app-shell-restyle.md): the drag
  // handle plugin restores a NodeRangeSelection over the dropped blocks
  // via its own `appendTransaction`, synchronously inside the "drop" DOM
  // event — which per the HTML5 drag-and-drop spec fires before the
  // element's own "dragend". `onElementDragEnd` is still deferred with
  // `requestAnimationFrame` here (not called from the drag-end handler
  // synchronously) so it also runs after any of the plugin's own pending
  // work for that same drag gesture, matching the delay that made the
  // race disappear in manual testing.
  it("collapses any leftover block selection once the drag-end callback fires", () => {
    editor = createHeadlessEditor("<p>primero</p><p>segundo</p>");
    render(<BlockHandle editor={editor} />);
    expect(capturedOnElementDragEnd).toBeInstanceOf(Function);

    capturedOnElementDragEnd?.({} as DragEvent);
    expect(blockSelection.collapseBlockSelection).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(blockSelection.collapseBlockSelection).toHaveBeenCalledTimes(1);
    expect(blockSelection.collapseBlockSelection).toHaveBeenCalledWith(editor);
  });

  // E3 follow-up (orchestrator repro, editor-pass-e3.md): the deferred
  // frame is the one selection-restore this codebase still allows after a
  // user interaction (drag-and-drop genuinely needs a frame for the drag-
  // handle plugin's own drop handling to settle first) — but it must still
  // bail out if something else already moved the selection by the time it
  // fires (a click, a keystroke), the same hazard that forced block-
  // context-menu.tsx's own close handling to become fully synchronous.
  it("does not collapse when the editor's selection already changed before the deferred frame fires", () => {
    editor = createHeadlessEditor("<p>primero</p><p>segundo</p>");
    render(<BlockHandle editor={editor} />);
    expect(capturedOnElementDragEnd).toBeInstanceOf(Function);

    capturedOnElementDragEnd?.({} as DragEvent);
    // Something else — a click, a keystroke — moves the selection into the
    // second paragraph before the deferred frame runs (the default initial
    // selection already sits at the very start of the first one, so this
    // must land somewhere genuinely different by VALUE, not just a new
    // object instance).
    editor.commands.setTextSelection(10);

    vi.runAllTimers();

    expect(blockSelection.collapseBlockSelection).not.toHaveBeenCalled();
  });

  // S7 review follow-up (R3-raf-not-cancelled, odd/tasks/app-shell-
  // restyle.md): unmounting (an App Router navigation away from the page)
  // within the deferred frame used to leave the scheduled
  // requestAnimationFrame pending, dispatching into a destroyed editor
  // once it eventually fired.
  it("cancels the pending drag-end animation frame on unmount, so a destroyed editor is never dispatched to", () => {
    editor = createHeadlessEditor("<p>primero</p><p>segundo</p>");
    const { unmount } = render(<BlockHandle editor={editor} />);
    expect(capturedOnElementDragEnd).toBeInstanceOf(Function);

    capturedOnElementDragEnd?.({} as DragEvent);
    unmount();

    vi.runAllTimers();

    expect(blockSelection.collapseBlockSelection).not.toHaveBeenCalled();
  });
});
