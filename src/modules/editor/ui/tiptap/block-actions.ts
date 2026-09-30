// Shared block-level actions (E2: block-context-menu.tsx's Copiar/
// Duplicar/Eliminar/Restablecer formato/Copiar enlace + the matching
// keyboard shortcuts registered on the editor, extensions/block-
// shortcuts.ts) — one implementation of each so the menu and the shortcut
// can never drift apart.
import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NODE_BACKGROUND_TYPES } from "./extensions/node-background";

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
    .focus()
    .insertContentAt(after, withoutBlockIds(ref.node.toJSON()))
    .run();
}

export function deleteBlock(editor: Editor, ref: BlockRef): void {
  editor
    .chain()
    .focus()
    .deleteRange({ from: ref.pos, to: ref.pos + ref.node.nodeSize })
    .run();
}

// Clears every inline mark (bold/italic/color/…) over the block's content
// and, for a type the "Fondo" row can target, its background attribute —
// "Restablecer formato" (E2 brief). Two separate commands/selections
// instead of one chain: `unsetAllMarks` needs a text selection over the
// content, `updateAttributes` needs a NodeSelection over the block itself,
// and a chain can't hold both at once.
export function resetBlockFormatting(editor: Editor, ref: BlockRef): void {
  const { from, to } = contentRange(ref);
  editor.chain().focus().setTextSelection({ from, to }).unsetAllMarks().run();
  const typeName = ref.node.type.name;
  if ((NODE_BACKGROUND_TYPES as readonly string[]).includes(typeName)) {
    editor
      .chain()
      .focus()
      .setNodeSelection(ref.pos)
      .updateAttributes(typeName, { nodeBackground: null })
      .run();
  }
}

// `blockId` comes from extensions/index.ts's UniqueID registration (E2
// brief, "@tiptap/extension-unique-id ... so blocks carry stable ids") —
// a deliberately different attrs key than "id" (see that registration's
// own comment for why: `@tiptap/extension-table-of-contents` already owns
// "id" on headings). A block created before that extension synced (or one
// of a type UniqueID isn't configured for) has no blockId yet — the caller
// (block-context-menu.tsx) hides "Copiar enlace" in that case rather than
// copying a broken link.
export function blockLinkFragment(ref: BlockRef): string | null {
  const id = ref.node.attrs.blockId;
  return typeof id === "string" && id ? `#block-${id}` : null;
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
