"use client";

// Per-block "⋮⋮" drag handle + "+" insert (S6b, odd/tasks/app-shell-
// restyle.md; Editor directive, .agents/skills/cogni-design/SKILL.md
// "Editor"): the left-gutter affordance from the Tiptap docs Notion-style
// editor. `DragHandle` (free `@tiptap/extension-drag-handle-react`) does
// the actual hover tracking, positioning and drag-and-drop reordering
// internally — it needs no extension registered in extensions/index.ts,
// per its own "Full Example" (only `children` render inside it); this file
// only renders the two gutter controls and wires "+" to insert an empty
// paragraph after the tracked block, then reuses the existing slash-menu
// trigger (slash-command.tsx) by inserting "/" into that new paragraph.
import type { Editor } from "@tiptap/core";
import DragHandle from "@tiptap/extension-drag-handle-react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { GripVertical, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { BlockContextMenu } from "./block-context-menu";
import { collapseBlockSelection } from "./block-selection";
import { focusEditorView } from "./focus-editor-view";

export interface BlockHandleProps {
  editor: Editor;
  // See BlockContextMenuProps.isBlockIdPersisted.
  isBlockIdPersisted?: (blockId: string) => boolean;
}

const HANDLE_BUTTON_CLASS =
  "flex size-6 items-center justify-center rounded-md text-fg-muted outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring";

export function BlockHandle({ editor, isBlockIdPersisted }: BlockHandleProps) {
  // Tracked via a ref, not state: `onNodeChange` fires on every pointer
  // move over the gutter, and this value is only read once, on the "+"
  // click — a re-render per hover frame would be wasted work.
  const hoveredRef = useRef<{ node: ProseMirrorNode; pos: number } | null>(
    null,
  );
  // S7 review follow-up (R3-raf-not-cancelled, odd/tasks/app-shell-
  // restyle.md): the id of the drag-end `requestAnimationFrame`, so an
  // unmount (an App Router navigation away from the page) between a drop
  // and the next frame can cancel it instead of leaving it to dispatch
  // into a by-then-destroyed editor.
  const dragEndFrameRef = useRef<number | null>(null);
  // Detaches the drag-end transaction listener (see `handleDragEnd`).
  const stopTrackingRef = useRef<(() => void) | null>(null);

  function cancelPendingDragEnd() {
    if (dragEndFrameRef.current !== null) {
      cancelAnimationFrame(dragEndFrameRef.current);
      dragEndFrameRef.current = null;
    }
    stopTrackingRef.current?.();
    stopTrackingRef.current = null;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: only the unmount cleanup matters; `cancelPendingDragEnd` reads refs only.
  useEffect(() => cancelPendingDragEnd, []);

  function insertBlockAfterHovered() {
    const hovered = hoveredRef.current;
    if (!hovered) return;
    // S7 review follow-up (R3-stale-hovered-block-position, odd/tasks/
    // app-shell-restyle.md): `onNodeChange` only fires on pointer moves
    // over the gutter, so `hovered` can be stale by the time "+" is
    // actually clicked (the user typed elsewhere first, or a remote
    // reconciliation replaced the document). Re-resolve from the CURRENT
    // document at that position and refuse to insert unless the same node
    // type still sits there — inserting against a stale position could
    // otherwise land mid another block or throw a RangeError once the
    // document has shrunk past it.
    const { doc } = editor.state;
    if (hovered.pos < 0 || hovered.pos >= doc.content.size) return;
    const current = doc.nodeAt(hovered.pos);
    if (!current || current.type !== hovered.node.type) return;
    const insertPos = hovered.pos + current.nodeSize;
    // No `.focus()` in this chain — see block-context-menu.tsx's
    // `applyBlockSelection` comment: Tiptap's own `focus` command defers the
    // real DOM `view.focus()` to a `requestAnimationFrame` callback, one
    // frame late enough for a fast subsequent interaction to land while the
    // editor still doesn't have it. `editor.view.focus()` right after
    // `.run()` is ProseMirror's own synchronous focus instead.
    editor
      .chain()
      .insertContentAt(insertPos, { type: "paragraph" })
      .setTextSelection(insertPos + 1)
      .insertContent("/")
      .run();
    focusEditorView(editor);
  }

  // S6b defect 1 (data loss, odd/tasks/app-shell-restyle.md): after a
  // drop, @tiptap/extension-drag-handle's own `appendTransaction`
  // (`buildRestoreTransaction`) restores a `NodeRangeSelection` over the
  // dropped blocks — synchronously, inside its document-level "drop"
  // listener. Per the HTML5 drag-and-drop spec, "drop" always fires before
  // this element's own "dragend", so that restore has already happened by
  // the time `onElementDragEnd` runs; deferring with `requestAnimationFrame`
  // additionally pushes this past the same frame's remaining work,
  // matching the delay that made the race disappear in manual testing.
  // `collapseBlockSelection` (block-selection.ts) then turns that leftover
  // block selection into a plain caret, so typing right after a drop
  // inserts text instead of replacing the whole moved block.
  //
  // E3 follow-up (orchestrator repro, editor-pass-e3.md): this is the ONE
  // deferred selection-restore this codebase still allows — drag-and-drop
  // genuinely needs a frame for the drag-handle plugin's own drop handling
  // to settle first — but the same class of bug applies here too: if the
  // user has ALREADY clicked (or typed) somewhere else by the time this
  // callback fires, blindly collapsing would clobber that. Capture the
  // selection's VALUE (not object reference — an unrelated transaction any
  // other extension dispatches in this window, touching nothing near this
  // selection, still produces a structurally new Selection instance via
  // ProseMirror's own position-mapping, so reference equality alone false-
  // positived on every such transaction in testing) synchronously when the
  // drag actually ends, and bail if it no longer matches when the frame
  // lands — a real value change here means something else (a click, a
  // keystroke) already moved it.
  function handleDragEnd() {
    cancelPendingDragEnd();
    const selectionAtDragEnd = editor.state.selection;
    // F3b (odd/tasks/review-followups.md): an unrelated document change in
    // this window (a remote edit, an id assignment) shifts positions without
    // the user touching the selection; comparing raw positions read that as
    // "the user moved it" and skipped the collapse, leaving a block selection
    // armed for the next keystroke. Map the captured selection through every
    // document change since drag end and compare THAT to the live one.
    const mapping = new Mapping();
    const trackChanges = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged) mapping.appendMapping(transaction.mapping);
    };
    editor.on("transaction", trackChanges);
    stopTrackingRef.current = () => editor.off("transaction", trackChanges);
    dragEndFrameRef.current = requestAnimationFrame(() => {
      dragEndFrameRef.current = null;
      stopTrackingRef.current?.();
      stopTrackingRef.current = null;
      const expected = selectionAtDragEnd.map(editor.state.doc, mapping);
      if (!editor.state.selection.eq(expected)) return;
      collapseBlockSelection(editor);
    });
  }

  return (
    <DragHandle
      editor={editor}
      onNodeChange={({ node, pos }) => {
        hoveredRef.current = node ? { node, pos } : null;
      }}
      onElementDragEnd={handleDragEnd}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Insertar bloque"
          data-testid="block-insert"
          className={HANDLE_BUTTON_CLASS}
          onClick={insertBlockAfterHovered}
        >
          <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
        </button>
        {/* E2 scope A: the SAME grip both drags (native HTML5 drag,
            @tiptap/extension-drag-handle-react's own behavior on this
            element) and, on a plain click (no pointer movement — browsers
            fire "click" instead of "dragstart" for that), opens the block
            context menu below. `getHoveredPos` re-reads `hoveredRef` at
            open time rather than closing over a stale value from whenever
            this render happened. */}
        <BlockContextMenu
          editor={editor}
          getHoveredPos={() => hoveredRef.current?.pos ?? null}
          isBlockIdPersisted={isBlockIdPersisted}
        >
          <button
            type="button"
            aria-label="Opciones del bloque"
            data-testid="block-drag-handle"
            className={`${HANDLE_BUTTON_CLASS} cursor-grab`}
            // E3 defect 1 (data loss, odd/tasks/editor-pass-e3.md): this
            // grip lives outside the editor's contentEditable DOM subtree
            // (it's rendered inside @tiptap/extension-drag-handle-react's
            // own floating wrapper). A mouse click on a native <button>
            // focuses it by default, and Radix's dropdown, once closed,
            // would otherwise auto-focus this same trigger — parking DOM
            // focus outside the editor with no text-selectable content
            // under it. tabIndex={-1} keeps it out of Tab order (Notion-
            // style: discovered by hover, not keyboard tabbing), and
            // preventDefault on mousedown suppresses the browser's default
            // "focus the button on mousedown" action so a click here never
            // steals focus from the editor to begin with — the dropdown
            // still opens (Radix's own open logic runs on pointerdown, a
            // separate event untouched by this), and block-context-menu.tsx's
            // `handleOpenChange` is what returns focus into the editor,
            // synchronously, once the menu closes.
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
          >
            <GripVertical aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </BlockContextMenu>
      </div>
    </DragHandle>
  );
}
