import { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type BlockRef, resolveBlockAt } from "./block-actions";
import {
  applyBlockSelection,
  handleGripMenuCloseAutoFocus,
} from "./block-context-menu";
import { createEditorExtensions } from "./extensions";

// E3 defect 1 (data loss, odd/tasks/editor-pass-e3.md): the block grip menu
// (block-handle.tsx's "⋮⋮" button) used to open without ever touching
// editor.state.selection. If the user had armed a cross-block TextSelection
// beforehand (Shift+Home from inside a paragraph, spanning up into the
// previous block) and then closed the menu with Escape, Radix's default
// onCloseAutoFocus returns DOM focus to the grip button — which lives
// outside the editor's contentEditable subtree — instead of back into the
// editor. With that stale multi-block selection still armed, the next
// keystrokes applied to it instead, deleting everything between anchor and
// head.
//
// Three orchestrator follow-up rounds, each confirmed against real Chromium
// repros (dadf45c, d29a7dd, 7e2f2ae):
//   1. fixing the open-time collapse alone wasn't enough — clicking a
//      different block right after Escape, then typing, still landed
//      content in the wrong place. Root cause: SOMETHING was still
//      restoring the selection to `ref` ASYNCHRONOUSLY after the menu
//      closed, after the user's own click already moved it — a real,
//      measured gap (Radix's DropdownMenuContent only calls
//      `onCloseAutoFocus` AFTER its exit animation finishes). Fixed by
//      removing the deferred path entirely: `applyBlockSelection` dispatches
//      synchronously (never `editor.chain().focus()`/`.commands.focus()`,
//      both of which defer the real DOM focus sync to a
//      `requestAnimationFrame`), and ALL close-time selection recovery moved
//      into `handleOpenChange`'s `next === false` branch, in the same tick
//      Escape/outside-click fires.
//   2. an `activeElement` probe on that fix found the SELECTION landed
//      correctly but DOM FOCUS didn't stick — Radix's FocusScope was still
//      mounted and fought `handleOpenChange`'s own `view.focus()` call, and
//      with `onCloseAutoFocus` doing nothing but `preventDefault()`, nothing
//      ever re-focused the editor once Radix finally unmounted: `document.
//      activeElement` ended up `<body>`. The user's next click then focused
//      the editor for the first time, which triggers ProseMirror's own
//      "focus" handler (prosemirror-view's input.ts) to schedule a short
//      delayed DOM/selection reconciliation — and keystrokes landing inside
//      that window hit the stale pre-reconciliation selection. Fixed by
//      `handleGripMenuCloseAutoFocus` below: ONLY `editor.view.focus()`,
//      synchronous, called once Radix has fully unmounted (nothing left to
//      contest it) — this both makes the editor the `activeElement` before
//      any later click (so that click never fires a fresh "focus" event at
//      all, and PM's reconciliation is never scheduled) and, since the
//      selection was already correct, gives PM's own delayed check nothing
//      to correct even if it did run.
//
// Real DOM focus/portal timing (Radix's FocusScope, the grip's own floating
// wrapper, the exit-animation delay itself) is a browser-only concern the
// orchestrator verifies visually; what's provable here in jsdom is the
// selection math `applyBlockSelection` produces and the exact, minimal
// behaviour of `handleGripMenuCloseAutoFocus`.
function createHeadlessEditor(content: string) {
  return new Editor({ extensions: createEditorExtensions(), content });
}

// Narrows `BlockRef | null` to `BlockRef` without a non-null assertion —
// `resolveBlockAt` returning null here would mean the test itself computed
// a bad position, so failing loudly is the right behaviour either way.
function requireBlockRef(ref: BlockRef | null): BlockRef {
  if (!ref) throw new Error("expected resolveBlockAt to find a block");
  return ref;
}

describe("applyBlockSelection", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("collapses a cross-block TextSelection into a caret at the target block's content start", () => {
    editor = createHeadlessEditor(
      "<h2>Titulo H2</h2><p>Parrafo uno.</p><ul><li>Item uno</li></ul>",
    );
    const doc = editor.state.doc;
    const heading = doc.child(0);
    const paragraphPos = heading.nodeSize; // top-level pos where <p> starts
    const paragraph = doc.child(1);
    const paragraphEnd = paragraphPos + paragraph.nodeSize - 1;

    // Reproduction: click into the paragraph, End, Shift+Home — a
    // TextSelection spanning from inside the heading through the end of the
    // paragraph, crossing the block boundary between them.
    editor.commands.setTextSelection({ from: 2, to: paragraphEnd });
    expect(editor.state.selection.empty).toBe(false);
    expect(editor.state.selection.from).toBeLessThan(paragraphPos);
    expect(editor.state.selection.to).toBeGreaterThan(paragraphPos);

    const ref = requireBlockRef(resolveBlockAt(editor, paragraphPos));

    applyBlockSelection(editor, ref);

    // The cross-block range must be gone: a collapsed caret inside the
    // paragraph only, never still reaching back into the heading.
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(paragraphPos + 1);
  });

  // Orchestrator follow-up, mechanism 1: the exact shape Shift+Home produces
  // — a BACKWARD TextSelection whose anchor sits at the paragraph's end and
  // whose head sits back at the heading's start. `from`/`to` are always the
  // normalized min/max of a selection regardless of direction, so this is a
  // distinct case from the forward one above: it proves the collapse target
  // comes from `ref` (the block the grip was opened on), never from
  // `selection.from`/`selection.to`/`anchor`/`head` — which here would all
  // resolve to the WRONG block (the heading) if anything read them.
  it("collapses into the ref block even when the live selection is backward and its anchor sits in the target block while its head sits in an earlier one", () => {
    editor = createHeadlessEditor(
      "<h2>Titulo H2</h2><p>Parrafo uno.</p><ul><li>Item uno</li></ul>",
    );
    const doc = editor.state.doc;
    const paragraphPos = doc.child(0).nodeSize;
    const paragraph = doc.child(1);
    const paragraphEnd = paragraphPos + paragraph.nodeSize - 1;

    const backward = TextSelection.create(editor.state.doc, paragraphEnd, 2);
    editor.view.dispatch(editor.state.tr.setSelection(backward));
    expect(editor.state.selection.anchor).toBe(paragraphEnd);
    expect(editor.state.selection.head).toBe(2);
    expect(editor.state.selection.from).toBe(2); // the heading, not the paragraph

    const ref = requireBlockRef(resolveBlockAt(editor, paragraphPos));

    applyBlockSelection(editor, ref);

    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(paragraphPos + 1);
  });

  it("uses a NodeSelection on the block itself for atom nodes (e.g. a horizontal rule), which have no content a text caret could sit inside", () => {
    editor = createHeadlessEditor("<p>antes</p><hr /><p>despues</p>");
    const doc = editor.state.doc;
    const first = doc.child(0);
    const rulePos = first.nodeSize;
    const ref = requireBlockRef(resolveBlockAt(editor, rulePos));
    expect(ref.node.isAtom).toBe(true);

    applyBlockSelection(editor, ref);

    expect(editor.state.selection.constructor.name).toBe("NodeSelection");
    expect(editor.state.selection.from).toBe(rulePos);
  });

  it("collapses a NodeSelection over another block the same way, matching the single-block variant the orchestrator confirmed already resets correctly", () => {
    editor = createHeadlessEditor("<p>uno</p><p>dos</p><p>tres</p>");
    const doc = editor.state.doc;
    const secondPos = doc.child(0).nodeSize;
    const thirdPos = secondPos + doc.child(1).nodeSize;

    // A NodeSelection on the middle block (the single-block case the
    // orchestrator's repro says already resets correctly on a later click)
    // — proves applyBlockSelection also collapses this starting point
    // cleanly, not only the multi-block TextSelection case above.
    editor.commands.setNodeSelection(secondPos);
    expect(editor.state.selection.constructor.name).toBe("NodeSelection");

    const ref = requireBlockRef(resolveBlockAt(editor, thirdPos));

    applyBlockSelection(editor, ref);

    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(thirdPos + 1);
  });

  it("focuses the editor view synchronously when asked to (the handleOpenChange(false) recovery path) — never a deferred requestAnimationFrame focus", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    editor = new Editor({
      extensions: createEditorExtensions(),
      content: "<p>uno</p><p>dos</p>",
      element: container,
    });
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const doc = editor.state.doc;
    const ref = requireBlockRef(resolveBlockAt(editor, doc.child(0).nodeSize));

    applyBlockSelection(editor, ref, { focus: true });

    // Synchronous: no fake timers, no `vi.runAllTimers()` — if this call
    // scheduled a `requestAnimationFrame` instead of calling `view.focus()`
    // directly, `editor.isFocused` would still be false right here.
    expect(editor.isFocused).toBe(true);
    outside.remove();
    container.remove();
  });
});

describe("handleGripMenuCloseAutoFocus", () => {
  let editor: Editor;
  let container: HTMLElement;

  afterEach(() => {
    editor?.destroy();
    container?.remove();
  });

  function createAttachedEditor(content: string): Editor {
    container = document.createElement("div");
    document.body.appendChild(container);
    return new Editor({
      extensions: createEditorExtensions(),
      content,
      element: container,
    });
  }

  it("calls preventDefault, then view.focus() — exactly once each, in that order — and dispatches no transaction", () => {
    editor = createAttachedEditor("<p>uno</p><p>dos</p>");
    const focusSpy = vi.spyOn(editor.view, "focus");
    const dispatchSpy = vi.spyOn(editor.view, "dispatch");
    const callOrder: string[] = [];
    focusSpy.mockImplementation(() => callOrder.push("focus"));
    const preventDefault = vi.fn(() => callOrder.push("preventDefault"));

    handleGripMenuCloseAutoFocus(editor, { preventDefault });

    // Order matters: block-context-menu.tsx's own comment on this function
    // — Radix composes its own "focus the trigger" default to run AFTER
    // this prop handler and skips it once the event is marked defaulted, so
    // `preventDefault()` must run before anything else for that default to
    // actually get suppressed.
    expect(callOrder).toEqual(["preventDefault", "focus"]);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    // No selection logic at all: `handleOpenChange` already dispatched the
    // correct selection synchronously before Radix even starts closing —
    // this handler runs later (after Radix's exit animation) and must be
    // pure focus, never a second, later writer of the same value.
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("focuses the editor view synchronously — no requestAnimationFrame, no fake timers needed", () => {
    editor = createAttachedEditor("<p>uno</p>");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    expect(editor.isFocused).toBe(false);

    handleGripMenuCloseAutoFocus(editor, { preventDefault: () => {} });

    expect(editor.isFocused).toBe(true);
    outside.remove();
  });
});
