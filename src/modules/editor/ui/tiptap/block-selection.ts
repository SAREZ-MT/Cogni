// S6b defect 1 (data loss, odd/tasks/app-shell-restyle.md): after a block
// drag-and-drop, @tiptap/extension-drag-handle's own `appendTransaction`
// (`buildRestoreTransaction`, see its dist bundle) restores a
// `NodeRangeSelection` over the dropped blocks so the drop target stays
// visibly "selected" — but ProseMirror's default behaviour when typing over
// a node or node-range selection is to REPLACE it, so the very next
// keystroke after a drop destroys the whole moved block instead of
// inserting a character. This is a race a real user can hit (typing
// immediately after a drop, before the browser's selectionchange flush
// lands), and it is not the Notion-style editor's behaviour regardless
// (the caret should land in the moved block). `collapseBlockSelection`
// turns any leftover block selection into a plain caret at the start of
// the first moved block's content; block-handle.tsx wires it in after the
// drag-handle plugin's own drop handling has settled.
import type { Editor } from "@tiptap/core";
import { isNodeRangeSelection } from "@tiptap/extension-node-range";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

export function collapseBlockSelection(editor: Editor): void {
  const { selection, doc } = editor.state;
  const isBlockSelection =
    selection instanceof NodeSelection || isNodeRangeSelection(selection);
  if (!isBlockSelection) return;

  const anchorPos = selection.from;
  const node = doc.nodeAt(anchorPos);

  // Atom/leaf blocks (image, horizontal rule, …) have no content a caret
  // could sit inside. Keeping a NodeSelection on the block itself is a
  // valid, safe selection here, and avoids resolving a position that may
  // not exist in a document made only of such nodes (Selection.near could
  // otherwise have nowhere valid to land).
  if (node?.isAtom) {
    editor.chain().setNodeSelection(anchorPos).run();
    return;
  }

  const $start = doc.resolve(Math.min(anchorPos + 1, doc.content.size));
  const nearSelection = TextSelection.near($start, 1);
  editor
    .chain()
    .setTextSelection({ from: nearSelection.from, to: nearSelection.from })
    .run();
}
