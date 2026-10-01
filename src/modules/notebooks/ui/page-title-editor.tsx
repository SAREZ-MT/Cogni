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
import { DEFAULT_PAGE_TITLE } from "../domain/page";

const SAVE_DEBOUNCE_MS = 600;

// E2 quick fix 1 (E1 screenshot follow-up): a brand-new page's stored
// title is the literal domain default ("Sin título" — domain/page.ts's
// `DEFAULT_PAGE_TITLE`), and rendering that as the textarea's `value`
// showed it as real typed text instead of a placeholder — typing appended
// onto it ("Sin títuloMitocondria…") instead of replacing it. Notion
// behaviour: the field starts EMPTY (so the `placeholder` below shows the
// muted "Sin título" copy) whenever the stored title equals the default.
function displayTitle(storedTitle: string): string {
  return storedTitle === DEFAULT_PAGE_TITLE ? "" : storedTitle;
}

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
  const [title, setTitle] = useState(() => displayTitle(initialTitle));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The last title actually confirmed saved (or the initial one) — a save
  // is skipped once the pending value already matches it, and a failed
  // save never advances it, so the next debounce/blur naturally retries
  // instead of silently giving up. Tracks the real STORED value (may be
  // DEFAULT_PAGE_TITLE), not the empty display value.
  const lastSavedRef = useRef(initialTitle);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last value the user typed (raw), or null before the first edit.
  const typedRef = useRef<string | null>(null);
  // The trimmed value whose save failed and is still unsaved: blur (flush)
  // resends it, so a transient failure is retried without another edit.
  const failedRef = useRef<string | null>(null);
  const inflightRef = useRef(0);

  // Adopts a new `initialTitle` from the server (a refresh after navigation
  // or revalidation) ONLY while the user has nothing of their own in play:
  // no pending debounce, no save in flight, and no typed value that differs
  // from what is stored. Otherwise the refresh would overwrite typing.
  useEffect(() => {
    const typed = typedRef.current;
    const hasLocalEdit =
      timerRef.current !== null ||
      pendingRef.current !== null ||
      inflightRef.current > 0 ||
      failedRef.current !== null ||
      (typed !== null && typed.trim() !== displayTitle(lastSavedRef.current));
    if (hasLocalEdit) return;
    setTitle(displayTitle(initialTitle));
    lastSavedRef.current = initialTitle;
    typedRef.current = null;
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
    inflightRef.current += 1;
    renamePageAction({ pageId, title: trimmed })
      .then(() => {
        lastSavedRef.current = trimmed;
        // A success supersedes any older failure: never resend a stale value.
        failedRef.current = null;
        onSaved?.(trimmed);
      })
      .catch(() => {
        // Best-effort: leave lastSavedRef unadvanced and remember the value,
        // so the next blur/Enter/unmount (flush) resends this exact value
        // instead of losing it, and a server refresh cannot overwrite it.
        if (typedRef.current?.trim() === trimmed) failedRef.current = trimmed;
      })
      .finally(() => {
        inflightRef.current -= 1;
      });
  }

  function scheduleSave(value: string) {
    pendingRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
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
    // A newer typed value wins; otherwise resend the value whose save failed.
    const next = pendingRef.current ?? failedRef.current;
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
    typedRef.current = value;
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
