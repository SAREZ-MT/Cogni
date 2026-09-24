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
import { GripVertical, Plus } from "lucide-react";
import { useRef } from "react";
import { collapseBlockSelection } from "./block-selection";

export interface BlockHandleProps {
  editor: Editor;
}

const HANDLE_BUTTON_CLASS =
  "flex size-6 items-center justify-center rounded-md text-fg-muted outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring";

export function BlockHandle({ editor }: BlockHandleProps) {
  // Tracked via a ref, not state: `onNodeChange` fires on every pointer
  // move over the gutter, and this value is only read once, on the "+"
  // click — a re-render per hover frame would be wasted work.
  const hoveredRef = useRef<{ node: ProseMirrorNode; pos: number } | null>(
    null,
  );

  function insertBlockAfterHovered() {
    const hovered = hoveredRef.current;
    if (!hovered) return;
    const insertPos = hovered.pos + hovered.node.nodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(insertPos, { type: "paragraph" })
      .setTextSelection(insertPos + 1)
      .insertContent("/")
      .run();
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
  function handleDragEnd() {
    requestAnimationFrame(() => {
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
        <button
          type="button"
          aria-label="Arrastrar bloque"
          data-testid="block-drag-handle"
          className={`${HANDLE_BUTTON_CLASS} cursor-grab`}
        >
          <GripVertical aria-hidden="true" size={16} strokeWidth={1.75} />
        </button>
      </div>
    </DragHandle>
  );
}
