"use client";

// Bubble toolbar for inline formatting on a non-empty text selection
// (S6a, odd/tasks/app-shell-restyle.md; Editor directive,
// .agents/skills/cogni-design/SKILL.md "Editor"): matches the Tiptap docs
// Notion-style editor's floating toolbar. `BubbleToolbarControls` is the
// plain presentational piece (testable with fireEvent, no floating-ui
// layout math) and `BubbleToolbar` wraps it in the real `BubbleMenu` for
// the editor — same split as highlight-picker.tsx/
// highlight-picker-controls.tsx, whose `HighlightPickerControls` this
// reuses for "Resaltar" instead of duplicating the palette.
import type { Editor } from "@tiptap/core";
import { isNodeRangeSelection } from "@tiptap/extension-node-range";
import type { EditorState } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Code,
  ExternalLink,
  Highlighter,
  Italic,
  Link as LinkIcon,
  type LucideIcon,
  Pencil,
  Strikethrough,
  Underline,
  Unlink,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { HighlightPickerControls } from "./highlight-picker-controls";

export interface BubbleToolbarProps {
  editor: Editor;
}

// S6a review follow-up (R3-shouldshow-unproved, folded into S6b): extracted
// as a pure function (out of the inline `shouldShow` closure) so it can be
// unit-tested directly against a headless editor, independent of
// floating-ui/BubbleMenu (bubble-toolbar.test.tsx's `shouldShowBubbleToolbar`
// describe block). specs/editor/spec.md family: the toolbar must not float
// over a selection inside a code block or over the image node — neither
// accepts inline text marks — nor while the selection is empty (nothing to
// format).
export interface ShouldShowBubbleToolbarArgs {
  editor: Editor;
  state: EditorState;
  from: number;
  to: number;
}

export function shouldShowBubbleToolbar({
  editor,
  state,
}: ShouldShowBubbleToolbarArgs): boolean {
  if (state.selection.empty) return false;
  // S7 review follow-up (R3-toolbar-over-block-selection, odd/tasks/
  // app-shell-restyle.md): a whole-block selection left by the drag
  // handle (block-handle.tsx) — a NodeSelection or a NodeRangeSelection —
  // has no inline text to format; Notion hides its inline toolbar for
  // exactly this case instead of floating it over the selected block(s).
  if (state.selection instanceof NodeSelection) return false;
  if (isNodeRangeSelection(state.selection)) return false;
  if (editor.isActive("codeBlock")) return false;
  if (editor.isActive("image")) return false;
  return true;
}

// S6b (odd/tasks/app-shell-restyle.md), Editor directive: caret-only inside
// an existing link (no selection) shows a compact popover instead of the
// full formatting toolbar (which stays hidden for an empty selection, see
// `shouldShowBubbleToolbar` above) — "Abrir"/"Editar"/"Quitar", matching
// the Tiptap docs Notion-style editor's inline-link affordance.
function shouldShowLinkPopover({
  editor,
  state,
}: ShouldShowBubbleToolbarArgs): boolean {
  return state.selection.empty && editor.isActive("link");
}

// specs/editor/spec.md family: the toolbar must not float over a selection
// inside a code block or over the image node — neither accepts inline text
// marks — nor while the selection is empty (nothing to format).
export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  return (
    <>
      <BubbleMenu
        editor={editor}
        pluginKey="cogni-bubble-toolbar"
        shouldShow={shouldShowBubbleToolbar}
      >
        <BubbleToolbarControls editor={editor} />
      </BubbleMenu>
      <BubbleMenu
        editor={editor}
        pluginKey="cogni-link-popover"
        shouldShow={shouldShowLinkPopover}
      >
        <LinkPopover editor={editor} />
      </BubbleMenu>
    </>
  );
}

interface MarkButtonConfig {
  mark: string;
  label: string;
  icon: LucideIcon;
  run: (editor: Editor) => void;
}

const MARK_BUTTONS: MarkButtonConfig[] = [
  {
    mark: "bold",
    label: "Negrita",
    icon: Bold,
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    mark: "italic",
    label: "Cursiva",
    icon: Italic,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    mark: "underline",
    label: "Subrayado",
    icon: Underline,
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    mark: "strike",
    label: "Tachado",
    icon: Strikethrough,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    mark: "code",
    label: "Código",
    icon: Code,
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
];

const BUTTON_CLASS =
  "flex size-8 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

function buttonToneClass(active: boolean) {
  return active
    ? "bg-active text-fg-active"
    : "text-fg-secondary hover:bg-hover";
}

export interface BubbleToolbarControlsProps {
  editor: Editor;
}

export function BubbleToolbarControls({ editor }: BubbleToolbarControlsProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [highlightOpen, setHighlightOpen] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // `editor.isActive(...)` alone does not trigger a re-render: it reads a
  // snapshot of the current transaction, but nothing here subscribes to
  // the editor's own state changes. `useEditorState` (used by the Tiptap
  // docs' own toolbar examples) re-renders this component exactly when
  // one of these selected values actually changes, so aria-pressed keeps
  // following clicks made through this same toolbar.
  const activeMarks = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      link: current.isActive("link"),
      highlight: current.isActive("highlight"),
    }),
  });

  // S6a review follow-up (R3-stale-toolbar-state, folded into S6b): a
  // primitive, comparable snapshot of the current selection. `BubbleMenu`
  // keeps this component mounted while it toggles the popup's own
  // visibility (it doesn't unmount it), so without this a link draft typed
  // for one selection could survive into the next, unrelated one.
  const selectionKey = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      `${current.state.selection.from}-${current.state.selection.to}`,
  });

  // Resets any open input/panel whenever the selection changes (a new
  // selection means a different formatting target — see the comment
  // above), so a stale draft URL never gets applied to it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectionKey is the sole intentional trigger, never read inside the effect body.
  useEffect(() => {
    setLinkOpen(false);
    setLinkValue("");
    setHighlightOpen(false);
  }, [selectionKey]);

  // Focuses the inline URL input as soon as it mounts, without the
  // `autoFocus` attribute (lint/a11y/noAutofocus).
  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  function openLinkInput() {
    const currentHref = editor.getAttributes("link").href as string | undefined;
    setLinkValue(currentHref ?? "");
    setHighlightOpen(false);
    setLinkOpen(true);
  }

  // Enter applies the URL via the existing link extension (empty removes
  // the link, matching the "Quitar resaltado"-style clear affordance);
  // Escape cancels without changing the mark.
  function applyLink() {
    const href = linkValue.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) {
      chain.setLink({ href }).run();
    } else {
      chain.unsetLink().run();
    }
    // S6b defect 2 (focus): `chain().focus()` above already restores the
    // selection, but @tiptap/core's `focus` command only calls the real
    // DOM `view.focus()` inside a `requestAnimationFrame` callback
    // (`delayedFocus`) — one frame later than `setLinkOpen(false)` below
    // removes this now-closed input from the DOM, which blurs to
    // `document.body` in between. `editor.view.focus()` is ProseMirror's
    // own synchronous focus, called here before the input unmounts so the
    // browser never has a focused-then-removed element to blur.
    editor.view.focus();
    setLinkOpen(false);
  }

  function handleLinkKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyLink();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setLinkOpen(false);
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Formato de texto"
      data-testid="bubble-toolbar"
      className="flex items-center gap-0.5 rounded-lg border border-border-default bg-card p-1 shadow-md"
    >
      {MARK_BUTTONS.map(({ mark, label, icon: Icon, run }) => {
        const active = activeMarks[mark as keyof typeof activeMarks] ?? false;
        return (
          <button
            key={mark}
            type="button"
            aria-label={label}
            aria-pressed={active}
            data-testid={`bubble-toolbar-${mark}`}
            className={`${BUTTON_CLASS} ${buttonToneClass(active)}`}
            onClick={() => run(editor)}
          >
            <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        );
      })}

      <span
        aria-hidden="true"
        className="bg-border-default mx-1 h-5 w-px shrink-0"
      />

      <div className="relative">
        <button
          type="button"
          aria-label="Enlace"
          aria-pressed={activeMarks.link}
          data-testid="bubble-toolbar-link"
          className={`${BUTTON_CLASS} ${buttonToneClass(activeMarks.link)}`}
          onClick={() => (linkOpen ? setLinkOpen(false) : openLinkInput())}
        >
          <LinkIcon aria-hidden="true" size={16} strokeWidth={1.75} />
        </button>
        {linkOpen && (
          <input
            ref={linkInputRef}
            type="text"
            value={linkValue}
            placeholder="https://…"
            aria-label="URL del enlace"
            data-testid="bubble-toolbar-link-input"
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={handleLinkKeyDown}
            className="border-border-default bg-card text-fg absolute top-full left-0 z-10 mt-1 w-48 rounded-md border px-2 py-1 text-xs shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Resaltar"
          aria-pressed={activeMarks.highlight}
          data-testid="bubble-toolbar-highlight"
          className={`${BUTTON_CLASS} ${buttonToneClass(activeMarks.highlight)}`}
          onClick={() => {
            setLinkOpen(false);
            setHighlightOpen((open) => !open);
          }}
        >
          <Highlighter aria-hidden="true" size={16} strokeWidth={1.75} />
        </button>
        {highlightOpen && (
          <div className="absolute top-full left-0 z-10 mt-1">
            <HighlightPickerControls editor={editor} />
          </div>
        )}
      </div>
    </div>
  );
}

const LINK_POPOVER_BUTTON_CLASS =
  "flex size-7 items-center justify-center rounded-md outline-none transition-colors text-fg-secondary hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring";

const LINK_URL_TRUNCATE_LENGTH = 36;

function truncateLinkUrl(url: string): string {
  if (url.length <= LINK_URL_TRUNCATE_LENGTH) return url;
  return `${url.slice(0, LINK_URL_TRUNCATE_LENGTH - 1)}…`;
}

export interface LinkPopoverProps {
  editor: Editor;
}

// S6b (odd/tasks/app-shell-restyle.md), Editor directive: shown while the
// caret sits inside an existing link with no selection (see
// `shouldShowLinkPopover` above) — the truncated URL, plus "Abrir" (opens
// it in a new tab), "Editar" (an inline input, same pattern as the main
// toolbar's link input above, prefilled with the current URL) and "Quitar"
// (removes the mark). Matches the Tiptap docs Notion-style editor's
// inline-link affordance.
export function LinkPopover({ editor }: LinkPopoverProps) {
  const href = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      (current.getAttributes("link").href as string | undefined) ?? "",
  });

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(href);
  const inputRef = useRef<HTMLInputElement>(null);

  // The caret can move from one link straight into another (or leave the
  // link entirely, hiding this popover): reset any local edit draft
  // whenever the URL this popover is showing changes, the same guard as
  // BubbleToolbarControls's own selection-reset effect above.
  useEffect(() => {
    setEditing(false);
    setValue(href);
  }, [href]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function applyEdit() {
    const nextHref = value.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (nextHref) {
      chain.setLink({ href: nextHref }).run();
    } else {
      chain.unsetLink().run();
    }
    // S6b defect 2 (focus): see the matching comment on applyLink above —
    // `editor.view.focus()` runs synchronously, before `setEditing(false)`
    // removes this input from the DOM.
    editor.view.focus();
    setEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
      setValue(href);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Enlace"
      data-testid="link-popover"
      className="border-border-default bg-card flex items-center gap-1 rounded-lg border p-1.5 shadow-md"
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          aria-label="URL del enlace"
          data-testid="link-popover-input"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className="text-fg w-48 rounded-md border-none px-1.5 py-1 text-xs outline-none"
        />
      ) : (
        <span
          title={href}
          className="text-fg-secondary max-w-48 truncate px-1 text-xs"
        >
          {truncateLinkUrl(href)}
        </span>
      )}

      <span
        aria-hidden="true"
        className="bg-border-default mx-0.5 h-5 w-px shrink-0"
      />

      <button
        type="button"
        aria-label="Abrir enlace"
        data-testid="link-popover-open"
        className={LINK_POPOVER_BUTTON_CLASS}
        onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
      >
        <ExternalLink aria-hidden="true" size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label="Editar enlace"
        data-testid="link-popover-edit"
        className={LINK_POPOVER_BUTTON_CLASS}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden="true" size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label="Quitar enlace"
        data-testid="link-popover-remove"
        className={LINK_POPOVER_BUTTON_CLASS}
        onClick={() => {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          // S6b defect 2 (focus): see the matching comment on applyLink
          // above. This popover unmounts once `isActive("link")` turns
          // false (the same transaction), so the synchronous refocus must
          // happen before that removal blurs to `document.body`.
          editor.view.focus();
        }}
      >
        <Unlink aria-hidden="true" size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
