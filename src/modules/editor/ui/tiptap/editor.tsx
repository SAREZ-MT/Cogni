"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAutosave } from "../../application/use-autosave";
import type { ImageUploadPort } from "../../domain/image-upload-port";
import type { MentionPort } from "../../domain/mention-port";
import type { SavePagePort, TiptapDoc } from "../../domain/save-page-port";
import { ConflictBanner } from "../conflict-banner";
import { SaveStatus } from "../save-status";
import { BlockHandle } from "./block-handle";
import { isBlockIdOnlyChange } from "./block-ids";
import { BubbleToolbar } from "./bubble-toolbar";
import { createEditorExtensions } from "./extensions";
import type { SlashCommandItem } from "./slash-command-items";
import { toPlainTiptapDoc } from "./to-plain-tiptap-doc";

export interface EditorProps {
  pageId: string;
  initialContent: TiptapDoc;
  initialVersion: number;
  port: SavePagePort;
  // Optional: pages composed without image support (e.g. a future
  // read-only view) can omit it; the image block then shows a friendly
  // error instead of throwing (image-node.tsx).
  imagePort?: ImageUploadPort;
  // E1 (goal doc §2, "@" mentions): injected by the app composition root
  // (mention-port.ts's header comment explains why editor/ui can't import
  // notebooks directly). Omitted (or a unit test rendering Editor alone)
  // means the "@" popup always resolves an empty list.
  mentionPort?: MentionPort;
  // E1 (coordinator addition, "Importar PDF" slash item): extra items
  // appended to SLASH_COMMAND_ITEMS, e.g. the composition root's PDF import
  // bridge (page-editor.tsx) — see slash-command.tsx's SlashCommandOptions
  // for why this can't just live inside slash-command-items.ts.
  extraSlashItems?: SlashCommandItem[];
  // S7 (odd/tasks/app-shell-restyle.md, drift #1): id of a DOM element
  // (rendered by PageHeader's statusSlot) to portal the autosave
  // SaveStatus into, so it sits in the page header's meta row next to
  // "Editada hace X" (screenshots/editor.png) instead of as a loose line
  // between the header and the first block. Optional and falls back to
  // rendering inline, right above the content, when omitted or when the
  // element doesn't exist yet (e.g. a unit test rendering Editor alone).
  statusPortalId?: string;
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
  imagePort,
  mentionPort,
  extraSlashItems,
  statusPortalId,
}: EditorProps) {
  // The slot element (rendered by PageHeader) doesn't exist yet on the
  // very first render of this client component, so this resolves it after
  // mount rather than during render — `createPortal` needs a real,
  // already-committed DOM node. Stays null (inline fallback) whenever
  // `statusPortalId` is omitted or the element can't be found.
  const [statusPortalNode, setStatusPortalNode] = useState<HTMLElement | null>(
    null,
  );
  useEffect(() => {
    setStatusPortalNode(
      statusPortalId ? document.getElementById(statusPortalId) : null,
    );
  }, [statusPortalId]);

  const {
    status,
    content,
    conflictDraft,
    reconcileVersion,
    setContent,
    flush,
    restoreDraft,
    discardDraft,
  } = useAutosave({
    pageId,
    initialContent,
    initialVersion,
    port,
  });

  const editor = useEditor({
    extensions: createEditorExtensions({
      pageId,
      imagePort: imagePort ?? null,
      mentionPort: mentionPort ?? null,
      extraSlashItems: extraSlashItems ?? [],
    }),
    content: initialContent as unknown as Record<string, unknown>,
    immediatelyRender: false,
    onUpdate: ({ editor: current, transaction }) => {
      // Opening a page is not editing it: the transaction UniqueID
      // dispatches to label legacy blocks changes nothing but ids, and
      // saving it would bump `updatedAt` (Home's recency metrics). The ids
      // reach the server with the next real edit, which always sends the
      // whole live document.
      if (isBlockIdOnlyChange(transaction.before, current.state.doc)) return;
      setContent(toPlainTiptapDoc(current.getJSON()));
    },
  });

  // design.md, "Autosave con debounce de cliente y reconciliación en la
  // UI": resync the Tiptap document from the hook's `content` only when
  // `reconcileVersion` actually changed — bumped exclusively by a real
  // server-driven reconciliation (version conflict or restoreDraft()),
  // never by the user's own typing. Watching `content` directly instead
  // (diffing its JSON every keystroke) would risk a "setContent echo"
  // that resets the user's cursor mid-word (PR3b review advisory).
  const appliedReconcileVersionRef = useRef(reconcileVersion);
  useEffect(() => {
    if (!editor) return;
    if (appliedReconcileVersionRef.current === reconcileVersion) return;
    appliedReconcileVersionRef.current = reconcileVersion;
    editor.commands.setContent(content as unknown as Record<string, unknown>, {
      emitUpdate: false,
    });
  }, [reconcileVersion, content, editor]);

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

  // specs/editor/spec.md, "Autosave con debounce y actualización
  // optimista": "Al salir de la página con cambios pendientes el editor
  // MUST intentar guardarlos". The debounce alone (800-1500ms) does not
  // cover a user closing the tab or navigating away mid-pause, so this
  // flushes on every signal Next.js's App Router (client-side navigation
  // has no router events; see node_modules/next/dist/docs/) and the
  // browser expose for "the user is leaving": the tab becoming hidden
  // (also covers mobile app-switching, which never fires beforeunload),
  // an actual unload, and this component unmounting (an App Router
  // client-side navigation away from the page). flush() itself is a
  // no-op when nothing is pending, so this never re-sends an already-
  // saved document. beforeunload intentionally never sets
  // `event.preventDefault()`/`returnValue`: the save is fire-and-forget,
  // not a blocking "are you sure?" confirmation, which is out of this
  // Requirement's scope.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    function handleBeforeUnload() {
      flush();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flush();
    };
  }, [flush]);

  const statusNode = <SaveStatus status={status} />;

  return (
    <div className="flex flex-col gap-2">
      {statusPortalNode
        ? createPortal(statusNode, statusPortalNode)
        : statusNode}
      <ConflictBanner
        conflictDraft={conflictDraft}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />
      {/* S6a (Editor directive): the bubble toolbar's "Resaltar" button
          now reuses HighlightPickerControls, so it replaces the standalone
          HighlightPicker BubbleMenu here — that module and its tests stay
          intact for direct/unit use. */}
      {editor ? <BubbleToolbar editor={editor} /> : null}
      {/* S6b (odd/tasks/app-shell-restyle.md): per-block "⋮⋮" drag handle +
          "+" insert in the left gutter, matching the Tiptap docs
          Notion-style editor. */}
      {editor ? <BlockHandle editor={editor} /> : null}
      {/* T13b (design fidelity, docs/design-system/screenshots/editor.png):
          `.editor-content` (src/app/globals.css) styles the real
          ProseMirror output against the Cogni type scale instead of
          `@tailwindcss/typography`'s generic `.prose` — see the comment
          above that block for why the plugin was rejected. The comfortable
          reading measure is the page route's `mx-auto max-w-2xl` section
          (notebooks/[notebookId]/pages/[pageId]/page.tsx), which also
          aligns the page title, so this stays `max-w-none`. */}
      <EditorContent
        editor={editor}
        data-testid="editor-content"
        className="editor-content max-w-none text-fg focus:outline-none"
      />
    </div>
  );
}
