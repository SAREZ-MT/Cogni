import type { Editor } from "@tiptap/core";

// Hands DOM focus back to the editor with ProseMirror's own synchronous
// `view.focus()` (Tiptap's `chain().focus()` defers it to a frame).
//
// A menu or popover can close after its editor is gone (navigating away
// unmounts the editor first): `editor.view` is a proxy that throws "The
// editor view is not available" for any property read once the view is
// unmounted or destroyed. `editor.isDestroyed` is true exactly when there is
// no live view (never mounted, unmounted or destroyed), so it is the guard.
export function focusEditorView(editor: Editor): void {
  if (editor.isDestroyed) return;
  editor.view.focus();
}
