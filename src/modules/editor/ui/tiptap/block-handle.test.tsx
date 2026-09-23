import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(
      screen.getByRole("button", { name: "Arrastrar bloque" }),
    ).toHaveAttribute("data-testid", "block-drag-handle");
  });

  it("gives the drag control a grab cursor", () => {
    editor = createHeadlessEditor();
    render(<BlockHandle editor={editor} />);

    expect(screen.getByTestId("block-drag-handle").className).toMatch(
      /cursor-grab/,
    );
  });

  it("clicking + inserts an empty paragraph after the tracked block and opens the slash menu with /", () => {
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
});
