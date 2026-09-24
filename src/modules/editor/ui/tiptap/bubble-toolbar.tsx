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
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  type LucideIcon,
  Strikethrough,
  Underline,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { HighlightPickerControls } from "./highlight-picker-controls";

export interface BubbleToolbarProps {
  editor: Editor;
}

// specs/editor/spec.md family: the toolbar must not float over a selection
// inside a code block or over the image node — neither accepts inline text
// marks — nor while the selection is empty (nothing to format).
export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="cogni-bubble-toolbar"
      shouldShow={({ editor: current, state }) => {
        if (state.selection.empty) return false;
        if (current.isActive("codeBlock")) return false;
        if (current.isActive("image")) return false;
        return true;
      }}
    >
      <BubbleToolbarControls editor={editor} />
    </BubbleMenu>
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
