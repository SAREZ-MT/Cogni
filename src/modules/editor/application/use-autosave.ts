"use client";

// This hook is exported from editor/index.ts alongside the Server-safe
// autosave state types. Since PR3b wires the barrel into
// src/app/(app)/notebooks/[notebookId]/pages/[pageId]/page.tsx (a Server
// Component), Next.js's RSC boundary check requires this file to declare
// its own "use client" directive — otherwise it treats a hook-using module
// as reachable from the server graph purely through the re-export, even
// though the hook itself is only ever called from editor/ui/tiptap/
// editor.tsx (already "use client").
import { useCallback, useEffect, useRef, useState } from "react";
import { isDomainErrorLike } from "@/shared/kernel/domain-error";
import type { AutosaveStatus } from "../domain/autosave-state";
import {
  PAGE_VERSION_CONFLICT_CODE,
  type SavePagePort,
  type TiptapDoc,
} from "../domain/save-page-port";

// Within the 800-1500ms range required by specs/editor/spec.md, "Autosave
// con debounce y actualización optimista".
const DEFAULT_DEBOUNCE_MS = 1000;

export interface UseAutosaveOptions {
  pageId: string;
  initialContent: TiptapDoc;
  initialVersion: number;
  port: SavePagePort;
  debounceMs?: number;
}

export interface UseAutosaveResult {
  status: AutosaveStatus;
  content: TiptapDoc;
  // The local draft discarded by a version-conflict reconciliation, kept
  // available until the caller decides to reapply or drop it (design.md,
  // "Autosave con debounce de cliente y reconciliación en la UI").
  conflictDraft: TiptapDoc | null;
  // Bumped only when `content` was replaced programmatically by the hook
  // itself (a conflict reconciliation or restoreDraft()) — never as a
  // side effect of setContent() reporting the user's own typing. editor/
  // ui/tiptap/editor.tsx watches this instead of diffing `content` on
  // every keystroke, so the Tiptap document is only ever resynced for a
  // real server-driven change (PR3b review advisory).
  reconcileVersion: number;
  // The document the server is known to hold: the initial content, then the
  // exact document of each successful save (never a newer local edit) or the
  // server's content after a conflict reconciliation.
  savedContent: TiptapDoc;
  setContent: (content: TiptapDoc) => void;
  // Cancels the pending debounce (if any) and saves immediately with the
  // latest content. Used for an explicit save shortcut (editor/ui,
  // Mod+S) on top of the regular debounced autosave.
  flush: () => void;
  // Re-applies the discarded local draft after a conflict reconciliation
  // and schedules a save against the now-current version
  // (specs/editor/spec.md, "Reconciliación del conflicto de versión").
  restoreDraft: () => void;
  // Drops the discarded local draft without reapplying it; the server's
  // content (already loaded into `content`) stays as-is.
  discardDraft: () => void;
}

// Framework-agnostic autosave hook: debounces content changes, saves
// through the injected SavePagePort, and reconciles a version conflict by
// reloading the server's content/version. No Tiptap import here — see
// design.md, "Tiptap y ProseMirror solo en editor/ui".
export function useAutosave({
  pageId,
  initialContent,
  initialVersion,
  port,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [content, setContentState] = useState<TiptapDoc>(initialContent);
  const [conflictDraft, setConflictDraft] = useState<TiptapDoc | null>(null);
  const [reconcileVersion, setReconcileVersion] = useState(0);
  const [savedContent, setSavedContent] = useState<TiptapDoc>(initialContent);

  const versionRef = useRef(initialVersion);
  const contentRef = useRef(initialContent);
  const savingRef = useRef(false);
  const dirtyDuringSaveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether there is an unsaved change (a pending debounce timer or a
  // change queued while a save was already in flight). flush() must be a
  // no-op without this: nothing pending and no save in flight means the
  // last known server state already matches contentRef, so an extra
  // save() call would be a wasted (and potentially conflicting) write.
  const pendingRef = useRef(false);

  const runSave = useCallback(async () => {
    if (savingRef.current) {
      dirtyDuringSaveRef.current = true;
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    pendingRef.current = false;
    setStatus("saving");

    // The port may reject instead of resolving to a Result (for example a
    // Server Action failing at the transport level). Treat that like a
    // failed save: keep the draft, show "error" and retry on the next
    // pause. The finally block guarantees savingRef is always released.
    try {
      const sent = contentRef.current;
      const result = await port.save({
        pageId,
        content: sent,
        expectedVersion: versionRef.current,
      });

      if (result.ok) {
        versionRef.current = result.value.version;
        setSavedContent(sent);
        setStatus("saved");
      } else if (
        isDomainErrorLike(result.error) &&
        result.error.code === PAGE_VERSION_CONFLICT_CODE
      ) {
        const current = await port.getCurrent(pageId);
        if (current.ok) {
          setConflictDraft(contentRef.current);
          contentRef.current = current.value.content;
          versionRef.current = current.value.version;
          setContentState(current.value.content);
          setSavedContent(current.value.content);
          setReconcileVersion((v) => v + 1);
          setStatus("conflict");
        } else {
          // getCurrent() itself failed (Result error, not a rejection):
          // do not leave the hook claiming "conflict" without having
          // reconciled anything — that would strand versionRef stale with
          // no server content loaded. Report a plain error and retry on
          // the next pause, same as a network failure (PR3b review
          // advisory).
          setStatus("error");
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      savingRef.current = false;
    }

    if (dirtyDuringSaveRef.current) {
      dirtyDuringSaveRef.current = false;
      void runSave();
    }
  }, [pageId, port]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus((current) => (current === "saving" ? current : "pending"));
    timerRef.current = setTimeout(() => {
      void runSave();
    }, debounceMs);
  }, [debounceMs, runSave]);

  const setContent = useCallback(
    (next: TiptapDoc) => {
      contentRef.current = next;
      setContentState(next);
      pendingRef.current = true;
      scheduleSave();
    },
    [scheduleSave],
  );

  // No-op when there is nothing pending and no save already in flight:
  // without this guard, Mod+S (or a save-on-leave trigger) right after a
  // successful autosave would re-send an already-saved, unchanged document
  // (PR3b review advisory).
  const flush = useCallback(() => {
    if (!pendingRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void runSave();
  }, [runSave]);

  const restoreDraft = useCallback(() => {
    setConflictDraft((draft) => {
      if (!draft) return draft;
      contentRef.current = draft;
      setContentState(draft);
      setReconcileVersion((v) => v + 1);
      pendingRef.current = true;
      scheduleSave();
      return null;
    });
  }, [scheduleSave]);

  const discardDraft = useCallback(() => {
    setConflictDraft(null);
    // The server content (already reflected in `content`/contentRef since
    // the conflict was reconciled) is authoritative again — nothing left
    // to save on the user's behalf.
    setStatus((current) => (current === "conflict" ? "saved" : current));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    status,
    content,
    conflictDraft,
    reconcileVersion,
    savedContent,
    setContent,
    flush,
    restoreDraft,
    discardDraft,
  };
}
