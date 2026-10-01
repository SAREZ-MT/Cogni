// Shared block-level actions (E2: block-context-menu.tsx's Copiar/
// Duplicar/Eliminar/Restablecer formato/Copiar enlace + the matching
// keyboard shortcuts registered on the editor, extensions/block-
// shortcuts.ts) — one implementation of each so the menu and the shortcut
// can never drift apart.
import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NODE_BACKGROUND_TYPES } from "./extensions/node-background";
import { focusEditorView } from "./focus-editor-view";

export interface BlockRef {
  node: ProseMirrorNode;
  pos: number;
}

// Re-derives {node, pos} from the CURRENT document instead of trusting a
// caller-held value: the same staleness guard block-handle.tsx's
// `insertBlockAfterHovered` already uses for the hovered block (a hover
// snapshot, or even a value read one event-loop turn earlier, can outlive
// a remote reconciliation that shrank the document under it).
export function resolveBlockAt(editor: Editor, pos: number): BlockRef | null {
  const { doc } = editor.state;
  if (pos < 0 || pos >= doc.content.size) return null;
  const node = doc.nodeAt(pos);
  if (!node) return null;
  return { node, pos };
}

// "The block under the cursor" (E2 brief, keyboard shortcuts): the
// top-level block whose range contains the current selection's head.
export function currentBlock(editor: Editor): BlockRef | null {
  const { $from } = editor.state.selection;
  return resolveBlockAt(editor, $from.before(1));
}

const LIST_ITEM_TYPES = ["listItem", "taskItem"];
// Cells cannot be removed on their own without breaking the table grid.
const TABLE_CELL_TYPES = ["tableCell", "tableHeader"];

// "The block under the caret" for a DESTRUCTIVE keyboard shortcut
// (Mod-Backspace): the smallest unit whose removal leaves a valid document,
// instead of `currentBlock`'s top-level container (which would take a whole
// list, quote or callout with it). That unit is:
//   - the caret's textblock, or its whole list/task item when it is the
//     item's first paragraph (so an item goes together with its sublist);
//   - widened to the parent while the unit is its parent's only child (an
//     emptied list, quote or callout cannot stay behind).
// The block handle and context menu keep acting on the top-level block the
// user points at; only the caret-driven shortcut narrows. Returns null in a
// table cell (let the default key handling run: a cell is not a block).
export function currentDeletableBlock(editor: Editor): BlockRef | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if (TABLE_CELL_TYPES.includes($from.node(d).type.name)) return null;
  }
  let depth = $from.depth;
  if (
    depth > 1 &&
    LIST_ITEM_TYPES.includes($from.node(depth - 1).type.name) &&
    $from.index(depth - 1) === 0
  ) {
    depth -= 1;
  }
  while (depth > 1 && $from.node(depth - 1).childCount === 1) depth -= 1;
  if (depth < 1) return null;
  return resolveBlockAt(editor, $from.before(depth));
}

function contentRange(ref: BlockRef): { from: number; to: number } {
  return { from: ref.pos + 1, to: ref.pos + ref.node.nodeSize - 1 };
}

// Copies the block's plain text, and its rendered HTML when the Clipboard
// API supports multi-type writes (Safari/older browsers fall back to text
// only — still useful, never a hard failure).
export function copyBlock(editor: Editor, ref: BlockRef): void {
  const text = ref.node.textContent;
  const dom = editor.view.nodeDOM(ref.pos);
  const html = dom instanceof HTMLElement ? dom.outerHTML : text;
  const nav = typeof navigator === "undefined" ? null : navigator;
  if (!nav?.clipboard) return;
  if (typeof ClipboardItem !== "undefined" && nav.clipboard.write) {
    const item = new ClipboardItem({
      "text/plain": new Blob([text], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    });
    nav.clipboard
      .write([item])
      .catch(() => nav.clipboard.writeText(text).catch(() => {}));
    return;
  }
  nav.clipboard.writeText(text).catch(() => {});
}

// A copied node would carry the original's `blockId` (and so would every
// nested block), leaving two blocks that answer to the same "Copiar enlace"
// fragment. Dropping the ids lets UniqueID mint fresh ones for the copy.
function withoutBlockIds(node: JSONContent): JSONContent {
  const { blockId: _blockId, ...attrs } = node.attrs ?? {};
  const copy: JSONContent = { ...node, attrs };
  if (node.content) copy.content = node.content.map(withoutBlockIds);
  return copy;
}

export function duplicateBlock(editor: Editor, ref: BlockRef): void {
  const after = ref.pos + ref.node.nodeSize;
  editor
    .chain()
    .insertContentAt(after, withoutBlockIds(ref.node.toJSON()))
    .run();
  focusEditorView(editor);
}

export function deleteBlock(editor: Editor, ref: BlockRef): void {
  editor
    .chain()
    .deleteRange({ from: ref.pos, to: ref.pos + ref.node.nodeSize })
    .run();
  focusEditorView(editor);
}

// Clears every inline mark (bold/italic/color/…) over the block's content
// and, for a type the "Fondo" row can target, its background attribute —
// "Restablecer formato" (E2 brief). Two separate commands/selections
// instead of one chain: `unsetAllMarks` needs a text selection over the
// content, `updateAttributes` needs a NodeSelection over the block itself,
// and a chain can't hold both at once.
export function resetBlockFormatting(editor: Editor, ref: BlockRef): void {
  const { from, to } = contentRange(ref);
  editor.chain().setTextSelection({ from, to }).unsetAllMarks().run();
  const typeName = ref.node.type.name;
  if ((NODE_BACKGROUND_TYPES as readonly string[]).includes(typeName)) {
    editor
      .chain()
      .setNodeSelection(ref.pos)
      .updateAttributes(typeName, { nodeBackground: null })
      .run();
  }
  focusEditorView(editor);
}

// `blockId` comes from extensions/index.ts's UniqueID registration (E2
// brief, "@tiptap/extension-unique-id ... so blocks carry stable ids") —
// a deliberately different attrs key than "id" (see that registration's
// own comment for why: `@tiptap/extension-table-of-contents` already owns
// "id" on headings). A block created before that extension synced (or one
// of a type UniqueID isn't configured for) has no blockId yet — the caller
// (block-context-menu.tsx) hides "Copiar enlace" in that case rather than
// copying a broken link.
export function blockLinkId(ref: BlockRef): string | null {
  const id = ref.node.attrs.blockId;
  return typeof id === "string" && id ? id : null;
}

export function blockLinkFragment(ref: BlockRef): string | null {
  const id = blockLinkId(ref);
  return id ? `#block-${id}` : null;
}

export function copyBlockLink(ref: BlockRef): void {
  const fragment = blockLinkFragment(ref);
  if (!fragment || typeof navigator === "undefined") return;
  const url =
    typeof window === "undefined"
      ? fragment
      : `${window.location.origin}${window.location.pathname}${fragment}`;
  navigator.clipboard?.writeText(url).catch(() => {});
}
