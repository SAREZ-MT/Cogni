// E2 brief, block-context-menu.tsx: "Keyboard shortcuts registered on the
// editor for the block under the cursor" — Copiar (⌘⇧C), Duplicar (⌘D),
// Eliminar (⌘⌫), acting on `currentBlock` (block-actions.ts: the top-level
// block containing the selection's head), the exact same implementation
// the context menu's own rows call.
//
// `Mod-Backspace` is deliberately narrower than the other two: browsers/
// Tiptap's own keymap already bind it to "delete the previous word" while
// typing, and stealing it unconditionally would break that everywhere in
// the document, not just at a block boundary. This only takes over when
// the selection is empty AND sits at the very start of the block's own
// content — the one place "delete word backward" has nothing left to do
// in this block anyway — and lets every other Mod-Backspace fall through
// to the default word-delete behavior.
import { Extension } from "@tiptap/core";
import {
  copyBlock,
  currentBlock,
  deleteBlock,
  duplicateBlock,
} from "../block-actions";

export const BlockShortcuts = Extension.create({
  name: "blockShortcuts",

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-c": () => {
        const ref = currentBlock(this.editor);
        if (!ref) return false;
        copyBlock(this.editor, ref);
        return true;
      },
      "Mod-d": () => {
        const ref = currentBlock(this.editor);
        if (!ref) return false;
        duplicateBlock(this.editor, ref);
        return true;
      },
      "Mod-Backspace": () => {
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const ref = currentBlock(this.editor);
        if (!ref) return false;
        const atBlockStart = selection.$from.parentOffset === 0;
        if (!atBlockStart) return false;
        deleteBlock(this.editor, ref);
        return true;
      },
    };
  },
});
