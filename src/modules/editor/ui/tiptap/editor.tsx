"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { useAutosave } from "../../application/use-autosave";
import type { SavePagePort, TiptapDoc } from "../../domain/save-page-port";
import { createEditorExtensions } from "./extensions";

// specs/editor/spec.md, "Autosave con debounce y actualización optimista":
// visible status copy, Spanish "tú", sentence case, no emoji
// (.agents/skills/cogni-design/SKILL.md).
const STATUS_COPY: Record<string, string> = {
  idle: "",
  pending: "guardando…",
  saving: "guardando…",
  saved: "guardado",
  error: "no se pudo guardar, reintentando…",
  conflict: "la página cambió en otra pestaña",
};

export interface EditorProps {
  pageId: string;
  initialContent: TiptapDoc;
  initialVersion: number;
  port: SavePagePort;
}

// The Tiptap-backed block editor (design.md, "Tiptap y ProseMirror solo en
// editor/ui"). Wires the framework-agnostic `useAutosave` hook (editor/
// application) to a real Tiptap instance: `onUpdate` feeds the hook,
// and the hook's reconciled `content` (after a version conflict) is synced
// back into the document.
export function Editor({
  pageId,
  initialContent,
  initialVersion,
  port,
}: EditorProps) {
  const { status, content, setContent, flush } = useAutosave({
    pageId,
    initialContent,
    initialVersion,
    port,
  });

  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: initialContent as unknown as Record<string, unknown>,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      setContent(current.getJSON() as TiptapDoc);
    },
  });

  // design.md, "Autosave con debounce de cliente y reconciliación en la
  // UI": when the hook replaces `content` after reloading the server's
  // version (conflict reconciliation), reflect it in the Tiptap document
  // without re-emitting onUpdate (which would otherwise reschedule a save
  // of content the user never typed).
  useEffect(() => {
    if (!editor) return;
    const currentJson = JSON.stringify(editor.getJSON());
    const nextJson = JSON.stringify(content);
    if (currentJson !== nextJson) {
      editor.commands.setContent(
        content as unknown as Record<string, unknown>,
        {
          emitUpdate: false,
        },
      );
    }
  }, [content, editor]);

  // specs/editor/spec.md's autosave requirement is debounce-driven; Mod+S
  // adds an explicit save on top of it without waiting for the pause.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    function handleKeydown(event: KeyboardEvent) {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
      if (!isSaveShortcut) return;
      event.preventDefault();
      flush();
    }
    dom.addEventListener("keydown", handleKeydown);
    return () => dom.removeEventListener("keydown", handleKeydown);
  }, [editor, flush]);

  return (
    <div className="flex flex-col gap-2">
      <output
        data-testid="autosave-status"
        aria-live="polite"
        className="text-fg-secondary text-xs"
      >
        {STATUS_COPY[status]}
      </output>
      <EditorContent
        editor={editor}
        data-testid="editor-content"
        className="prose prose-sm max-w-none text-fg focus:outline-none"
      />
    </div>
  );
}
