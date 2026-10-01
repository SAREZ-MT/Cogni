"use client";

// Bubble toolbar for inline formatting on a non-empty text selection
// (S6a/E2, odd/tasks/app-shell-restyle.md; Editor directive,
// .agents/skills/cogni-design/SKILL.md "Editor"): matches the Tiptap docs
// Notion-style editor's floating toolbar. `BubbleToolbarControls` is the
// plain presentational piece (testable with fireEvent, no floating-ui
// layout math) and `BubbleToolbar` wraps it in the real `BubbleMenu` for
// the editor — same split as highlight-picker.tsx/
// highlight-picker-controls.tsx, whose `HighlightPickerControls` this
// still reuses unchanged for the color popover's "Fondo/Resaltado" row.
import type { Editor } from "@tiptap/core";
import { isNodeRangeSelection } from "@tiptap/extension-node-range";
import type { EditorState } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  Code,
  ExternalLink,
  Italic,
  Link as LinkIcon,
  type LucideIcon,
  Pencil,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  applySelectionTextColor,
  TEXT_COLOR_SWATCHES,
} from "./block-color-palette";
import { BLOCK_KIND_ITEMS, currentBlockKindLabel } from "./block-kind";
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
  shortcut: string;
  icon: LucideIcon;
  run: (editor: Editor) => void;
}

const MARK_BUTTONS: MarkButtonConfig[] = [
  {
    mark: "bold",
    label: "Negrita",
    shortcut: "Mod+B",
    icon: Bold,
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    mark: "italic",
    label: "Cursiva",
    shortcut: "Mod+I",
    icon: Italic,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    mark: "underline",
    label: "Subrayado",
    shortcut: "Mod+U",
    icon: Underline,
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    mark: "strike",
    label: "Tachado",
    shortcut: "Mod+Shift+S",
    icon: Strikethrough,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    mark: "code",
    label: "Código",
    shortcut: "Mod+E",
    icon: Code,
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    mark: "superscript",
    label: "Superíndice",
    shortcut: "Mod+.",
    icon: Superscript,
    run: (editor) => editor.chain().focus().toggleSuperscript().run(),
  },
  {
    mark: "subscript",
    label: "Subíndice",
    shortcut: "Mod+,",
    icon: Subscript,
    run: (editor) => editor.chain().focus().toggleSubscript().run(),
  },
];

const ALIGN_OPTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "left", label: "Izquierda", icon: AlignLeft },
  { id: "center", label: "Centro", icon: AlignCenter },
  { id: "right", label: "Derecha", icon: AlignRight },
  { id: "justify", label: "Justificado", icon: AlignJustify },
];

const BUTTON_CLASS =
  "flex size-8 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

function buttonToneClass(active: boolean) {
  return active
    ? "bg-active text-fg-active"
    : "text-fg-secondary hover:bg-hover";
}

function ToolbarSeparator() {
  return (
    <span
      aria-hidden="true"
      className="bg-border-default mx-1 h-5 w-px shrink-0"
    />
  );
}

// Wraps a toolbar button with a tooltip showing its label + shortcut (E2
// brief: "32 px icon buttons ... tooltips with the shortcut"). `asChild`
// forwards the tooltip's a11y wiring onto the real button instead of
// adding an extra wrapper element, so `data-testid`/`aria-pressed` on the
// button itself stay exactly where the existing tests already look.
function ToolbarButton({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? ` · ${shortcut}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export interface BubbleToolbarControlsProps {
  editor: Editor;
}

export function BubbleToolbarControls({ editor }: BubbleToolbarControlsProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
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
      superscript: current.isActive("superscript"),
      subscript: current.isActive("subscript"),
      link: current.isActive("link"),
      highlight: current.isActive("highlight"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
      blockLabel: currentBlockKindLabel(current),
      align: ALIGN_OPTIONS.find((option) =>
        current.isActive({ textAlign: option.id }),
      )?.id,
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
  }, [selectionKey]);

  // Focuses the inline URL input as soon as it mounts, without the
  // `autoFocus` attribute (lint/a11y/noAutofocus).
  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  function openLinkInput() {
    const currentHref = editor.getAttributes("link").href as string | undefined;
    setLinkValue(currentHref ?? "");
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
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Formato de texto"
        data-testid="bubble-toolbar"
        className="flex items-center gap-0.5 rounded-lg border border-border-default bg-card p-1 shadow-md"
      >
        {/* E2 scope B: "Convertir en" — same catalogue and commands as
            block-context-menu.tsx's own submenu, applied to whatever block
            the current selection sits in instead of a hovered one. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Convertir en"
              data-testid="bubble-toolbar-block-type"
              className={`${BUTTON_CLASS} w-auto gap-1 px-2 text-fg-secondary hover:bg-hover`}
            >
              <span className="text-[13px]">{activeMarks.blockLabel}</span>
              <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-48 rounded-xl p-1"
          >
            {BLOCK_KIND_ITEMS.map((kind) => (
              <DropdownMenuItem
                key={kind.id}
                className="gap-2 text-[13.5px]"
                onSelect={() => kind.run(editor)}
              >
                <kind.icon aria-hidden="true" size={16} strokeWidth={1.75} />
                {kind.label}
                {kind.isActive(editor) && (
                  <DropdownMenuShortcut>✓</DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarSeparator />

        <ToolbarButton label="Deshacer" shortcut="Mod+Z">
          <button
            type="button"
            aria-label="Deshacer"
            data-testid="bubble-toolbar-undo"
            disabled={!activeMarks.canUndo}
            className={`${BUTTON_CLASS} ${buttonToneClass(false)} disabled:pointer-events-none disabled:opacity-40`}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </ToolbarButton>
        <ToolbarButton label="Rehacer" shortcut="Mod+Shift+Z">
          <button
            type="button"
            aria-label="Rehacer"
            data-testid="bubble-toolbar-redo"
            disabled={!activeMarks.canRedo}
            className={`${BUTTON_CLASS} ${buttonToneClass(false)} disabled:pointer-events-none disabled:opacity-40`}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </ToolbarButton>

        <ToolbarSeparator />

        {MARK_BUTTONS.map(({ mark, label, shortcut, icon: Icon, run }) => {
          const active = activeMarks[mark as keyof typeof activeMarks] ?? false;
          return (
            <ToolbarButton key={mark} label={label} shortcut={shortcut}>
              <button
                type="button"
                aria-label={label}
                aria-pressed={Boolean(active)}
                data-testid={`bubble-toolbar-${mark}`}
                className={`${BUTTON_CLASS} ${buttonToneClass(Boolean(active))}`}
                onClick={() => run(editor)}
              >
                <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
              </button>
            </ToolbarButton>
          );
        })}

        <ToolbarSeparator />

        {/* E2 scope B: one popover, two swatch rows — "Texto" (inline
            Color/TextStyle mark, block-color-palette.ts) and
            "Fondo/Resaltado" (the existing CogniHighlight mark, unchanged
            — HighlightPickerControls keeps its own `highlight-picker`
            testid and "Resaltar en <color>" swatch names). */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Color de texto"
              aria-pressed={activeMarks.highlight}
              data-testid="bubble-toolbar-color"
              className={`${BUTTON_CLASS} ${buttonToneClass(activeMarks.highlight)}`}
            >
              <Baseline aria-hidden="true" size={16} strokeWidth={1.75} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto gap-2 p-2">
            <p className="px-0.5 text-fg-muted text-xs font-medium">Texto</p>
            <div className="flex flex-wrap gap-1 px-0.5">
              {TEXT_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  aria-label={swatch.label}
                  title={swatch.label}
                  data-testid={`bubble-toolbar-text-color-${swatch.id}`}
                  className="flex size-7 items-center justify-center rounded-md outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => applySelectionTextColor(editor, swatch.id)}
                >
                  <span
                    aria-hidden="true"
                    className={`size-3.5 shrink-0 rounded-full ${swatch.swatchClass}`}
                  />
                </button>
              ))}
            </div>
            <p className="px-0.5 text-fg-muted text-xs font-medium">
              Fondo / Resaltado
            </p>
            <HighlightPickerControls editor={editor} />
          </PopoverContent>
        </Popover>

        <ToolbarSeparator />

        {/* E2 scope B: alineación (dropdown, not a segmented row — matches
            "Convertir en"'s trigger shape). */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Alineación"
              data-testid="bubble-toolbar-align"
              className={`${BUTTON_CLASS} w-auto gap-1 px-1.5 ${buttonToneClass(Boolean(activeMarks.align))}`}
            >
              {(() => {
                const Icon =
                  ALIGN_OPTIONS.find(
                    (option) => option.id === activeMarks.align,
                  )?.icon ?? AlignLeft;
                return <Icon aria-hidden="true" size={16} strokeWidth={1.75} />;
              })()}
              <ChevronDown aria-hidden="true" size={12} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-40 rounded-xl p-1"
          >
            {ALIGN_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.id}
                className="gap-2 text-[13.5px]"
                onSelect={() =>
                  editor.chain().focus().setTextAlign(option.id).run()
                }
              >
                <option.icon aria-hidden="true" size={16} strokeWidth={1.75} />
                {option.label}
                {activeMarks.align === option.id && (
                  <DropdownMenuShortcut>✓</DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarSeparator />

        <div className="relative">
          <ToolbarButton label="Enlace" shortcut="Mod+K">
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
          </ToolbarButton>
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
      </div>
    </TooltipProvider>
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
