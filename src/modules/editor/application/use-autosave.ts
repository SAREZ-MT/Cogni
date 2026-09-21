import { useCallback, useEffect, useRef, useState } from "react";
import { isDomainError } from "@/shared/kernel/domain-error";
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
  setContent: (content: TiptapDoc) => void;
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

  const versionRef = useRef(initialVersion);
  const contentRef = useRef(initialContent);
  const savingRef = useRef(false);
  const dirtyDuringSaveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSave = useCallback(async () => {
    if (savingRef.current) {
      dirtyDuringSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    setStatus("saving");

    // The port may reject instead of resolving to a Result (for example a
    // Server Action failing at the transport level). Treat that like a
    // failed save: keep the draft, show "error" and retry on the next
    // pause. The finally block guarantees savingRef is always released.
    try {
      const result = await port.save({
        pageId,
        content: contentRef.current,
        expectedVersion: versionRef.current,
      });

      if (result.ok) {
        versionRef.current = result.value.version;
        setStatus("saved");
      } else if (
        isDomainError(result.error) &&
        result.error.code === PAGE_VERSION_CONFLICT_CODE
      ) {
        const current = await port.getCurrent(pageId);
        if (current.ok) {
          setConflictDraft(contentRef.current);
          contentRef.current = current.value.content;
          versionRef.current = current.value.version;
          setContentState(current.value.content);
        }
        setStatus("conflict");
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
      scheduleSave();
    },
    [scheduleSave],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { status, content, conflictDraft, setContent };
}
