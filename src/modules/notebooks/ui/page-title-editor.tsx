"use client";

// Notion-style editable page title (goal doc §1). A single-line, auto-
// growing `<textarea>` instead of the old static `<h1>{title}</h1>`
// (page-header.tsx) — no border, full reading width, the design's 36px/700/
// 1.1 scale (deliberately larger than PageHeader's old --text-3xl/30px, per
// the Notion-like template's own title treatment).
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { renamePage as renamePageAction } from "../actions";

const SAVE_DEBOUNCE_MS = 600;

export interface PageTitleEditorProps {
  pageId: string;
  initialTitle: string;
  // Fires with the trimmed, non-empty title right after a successful save
  // (debounced or flushed on blur/Enter) — the route's client wrapper
  // (app/(app)/.../_components/page-title.tsx) uses this to keep the
  // breadcrumb's last segment and Home/list fresh; notebooks/ui itself has
  // no business knowing about the app's breadcrumb context.
  onSaved?: (title: string) => void;
}

// Tiptap/ProseMirror's own contentEditable root always carries this stable
// class (unchanged across Tiptap majors); editor.tsx's `EditorContent`
// wraps it in `data-testid="editor-content"`. Queried by plain DOM APIs,
// never imported — design.md, "Tiptap y ProseMirror solo en editor/ui"
// keeps notebooks/ui out of the Tiptap/ProseMirror dependency graph
// entirely (enforced by the `editor-tiptap-only-in-ui` dependency-cruiser
// rule), so "focus the editor's first block" has to stay a DOM query
// instead of an imperative editor ref.
function focusEditorStart(): void {
  document
    .querySelector<HTMLElement>('[data-testid="editor-content"] .ProseMirror')
    ?.focus();
}

export function PageTitleEditor({
  pageId,
  initialTitle,
  onSaved,
}: PageTitleEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The last title actually confirmed saved (or the initial one) — a save
  // is skipped once the pending value already matches it, and a failed
  // save never advances it, so the next debounce/blur naturally retries
  // instead of silently giving up.
  const lastSavedRef = useRef(initialTitle);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
    lastSavedRef.current = initialTitle;
  }, [initialTitle]);

  // Auto-grow to fit a long title instead of scrolling inside a fixed
  // one-line box.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `title` drives scrollHeight and isn't otherwise read in the body — it's a deliberate re-run trigger, not a missing reference.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  function save(value: string) {
    const trimmed = value.trim();
    // "empty → keep 'Sin título' (do not save empty)": the native
    // `placeholder` already renders the muted "Sin título" copy whenever
    // the field is empty, so this only has to skip the network call.
    if (!trimmed || trimmed === lastSavedRef.current) return;
    renamePageAction({ pageId, title: trimmed })
      .then(() => {
        lastSavedRef.current = trimmed;
        onSaved?.(trimmed);
      })
      .catch(() => {
        // Best-effort: leave lastSavedRef unadvanced so the next
        // debounce/blur retries this exact value instead of losing it.
      });
  }

  function scheduleSave(value: string) {
    pendingRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next !== null) save(next);
    }, SAVE_DEBOUNCE_MS);
  }

  function flush() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next !== null) save(next);
  }

  // Flushes a still-pending save if this unmounts mid-debounce (e.g. a
  // fast client-side navigation away right after typing). Deliberately
  // empty deps: `flush` closes over the latest refs on every render, but
  // this only needs to register the cleanup once and run it on unmount,
  // not re-run on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above — only the unmount cleanup matters here.
  useEffect(() => flush, []);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    // A title is always a single logical line — strips a literal newline
    // from a paste, on top of Enter itself being prevented below.
    const value = event.target.value.replace(/\n/g, "");
    setTitle(value);
    scheduleSave(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    // Notion-style: Enter moves into the document instead of adding a
    // newline to the title.
    event.preventDefault();
    flush();
    focusEditorStart();
  }

  return (
    <textarea
      ref={textareaRef}
      data-testid="page-title-input"
      aria-label="Título de la página"
      rows={1}
      value={title}
      placeholder="Sin título"
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={flush}
      className="w-full resize-none overflow-hidden border-none bg-transparent font-bold text-[36px] text-fg leading-[1.1] outline-none placeholder:text-fg-muted"
    />
  );
}
