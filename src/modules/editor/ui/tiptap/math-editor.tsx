"use client";

// H7 (editor polish round 2): the LaTeX input with a live KaTeX preview.
// It opens on a MATH_EDIT_EVENT (the slash menu's "Ecuación" entries, a
// click on a formula or Enter on a selected one — extensions/math-
// editing.ts), floats under the formula or the caret, and writes through
// `commitMath`: Enter (or the button) inserts or saves, Shift+Enter adds a
// line, Escape or a click outside cancels. KaTeX and its fonts are bundled
// (extensions/index.ts imports katex.min.css); nothing loads from a CDN.
import type { Editor } from "@tiptap/core";
import katex from "katex";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/ui/button";
import {
  commitMath,
  MATH_EDIT_EVENT,
  type MathEditRequest,
  normalizeLatex,
} from "./extensions/math-editing";
import { focusEditorView } from "./focus-editor-view";

const PANEL_WIDTH = 384;
const GUTTER = 8;

interface Anchor {
  top: number;
  left: number;
}

function anchorFor(editor: Editor, request: MathEditRequest): Anchor {
  try {
    const rect =
      request.pos === null
        ? editor.view.coordsAtPos(editor.state.selection.from)
        : (
            editor.view.nodeDOM(request.pos) as HTMLElement
          ).getBoundingClientRect();
    const maxLeft = window.innerWidth - PANEL_WIDTH - GUTTER;
    return {
      top: rect.bottom + GUTTER,
      left: Math.max(GUTTER, Math.min(rect.left, maxLeft)),
    };
  } catch {
    // No layout (a detached or headless view): top-left of the viewport.
    return { top: GUTTER, left: GUTTER };
  }
}

export interface MathEditorProps {
  editor: Editor;
}

export function MathEditor({ editor }: MathEditorProps) {
  const [request, setRequest] = useState<MathEditRequest | null>(null);
  const [value, setValue] = useState("");
  const [anchor, setAnchor] = useState<Anchor>({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const hintId = useId();

  useEffect(() => {
    const dom = editor.view.dom;
    function handleRequest(event: Event) {
      const detail = (event as CustomEvent<MathEditRequest>).detail;
      setRequest(detail);
      setValue(detail.latex);
      setAnchor(anchorFor(editor, detail));
    }
    dom.addEventListener(MATH_EDIT_EVENT, handleRequest);
    return () => dom.removeEventListener(MATH_EDIT_EVENT, handleRequest);
  }, [editor]);

  const close = useCallback(() => {
    setRequest(null);
    focusEditorView(editor);
  }, [editor]);

  // Focus the input once it mounts (no `autoFocus`: lint/a11y/noAutofocus).
  useEffect(() => {
    if (request) inputRef.current?.focus();
  }, [request]);

  // Live preview: KaTeX renders into the preview node on every change;
  // `throwOnError: false` shows a malformed formula in red instead of
  // throwing.
  useEffect(() => {
    const preview = previewRef.current;
    if (!request || !preview) return;
    const latex = normalizeLatex(value);
    if (!latex) {
      preview.textContent = "La vista previa aparece aquí";
      return;
    }
    katex.render(latex, preview, {
      throwOnError: false,
      displayMode: request.kind === "block",
    });
  }, [request, value]);

  // A click outside the panel cancels, like Escape.
  useEffect(() => {
    if (!request) return;
    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [request, close]);

  if (!request) return null;
  const isNew = request.pos === null;

  function save() {
    if (!request) return;
    commitMath(editor, request, value);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={request.kind === "block" ? "Ecuación" : "Ecuación en línea"}
      data-testid="math-editor"
      className="editor-surface fixed z-50 flex flex-col gap-2 border border-border-default bg-card p-2 shadow-md"
      style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
    >
      <textarea
        ref={inputRef}
        aria-label="LaTeX"
        aria-describedby={hintId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        spellCheck={false}
        placeholder="Escribe o pega LaTeX, por ejemplo \frac{a}{b}"
        className="w-full resize-none rounded-(--radius-editor) border border-border-default bg-code-block px-2 py-1.5 font-mono text-[13px] text-fg outline-none placeholder:text-ink-placeholder focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div
        ref={previewRef}
        data-testid="math-preview"
        className="min-h-10 overflow-x-auto px-1 py-1 text-center text-fg text-sm [&_.katex-display]:m-0"
      />
      <div className="flex items-center justify-between gap-2">
        <span id={hintId} className="text-fg-muted text-xs">
          Enter para {isNew ? "insertar" : "guardar"} · Shift+Enter, nueva línea
        </span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={save}>
            {isNew ? "Insertar" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
