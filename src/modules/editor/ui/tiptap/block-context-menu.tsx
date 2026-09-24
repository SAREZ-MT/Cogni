"use client";

// E2 scope A: the drag-handle's "⋮⋮" context menu — clicking the grip
// (block-handle.tsx) opens this instead of only dragging. Styled with the
// shared `dropdown-menu` atom (docs/design-system: white card, radius 12,
// shadow-md), matching the rest of the design system rather than a
// hand-rolled popup.
import type { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
  ClipboardCopy,
  Copy,
  Download,
  Eraser,
  Link as LinkIcon,
  Palette,
  Trash2,
  Type,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  type BlockRef,
  blockLinkId,
  copyBlock,
  copyBlockLink,
  deleteBlock,
  duplicateBlock,
  resetBlockFormatting,
  resolveBlockAt,
} from "./block-actions";
import {
  applyBlockBackground,
  applyBlockTextColor,
  BACKGROUND_COLOR_SWATCHES,
  type ColorSwatch,
  TEXT_COLOR_SWATCHES,
} from "./block-color-palette";
import { BLOCK_KIND_ITEMS } from "./block-kind";

export interface BlockContextMenuProps {
  editor: Editor;
  // Re-resolved from the CURRENT document on open (same staleness guard as
  // block-handle.tsx's own "+" button) rather than a snapshot taken at
  // hover time — the menu can stay open for a while, well past whatever
  // was true the moment the grip was clicked.
  getHoveredPos: () => number | null;
  // "Copiar enlace" points at a block id, which only means something once the
  // id is stored: ids labeled in the live document but not yet saved would
  // yield a link that breaks on reload. Unknown counts as not persisted.
  isBlockIdPersisted?: (blockId: string) => boolean;
  children: ReactNode;
}

function SwatchDot({ swatch }: { swatch: ColorSwatch }) {
  return (
    <span
      aria-hidden="true"
      className={`size-3.5 shrink-0 rounded-full ${swatch.swatchClass}`}
    />
  );
}

// E3 defect 1 (data loss, odd/tasks/editor-pass-e3.md): the one selection
// the grip menu ever leaves behind, used on BOTH open and close so there is
// exactly one place this branches. Atoms (image, hr, …) have no content a
// text caret could sit inside, so they get a NodeSelection on themselves —
// the same atom check block-selection.ts's collapseBlockSelection already
// uses for the drag-and-drop version of this same selection hazard.
// Everything else gets a plain collapsed caret at the start of its content.
//
// E3 follow-up (orchestrator repro on dadf45c): built directly from `ref` +
// `view.state.doc` and dispatched via the raw ProseMirror view, on purpose
// — never `editor.chain().focus()...`. Tiptap's own `focus` command reads
// `editor.state.selection` internally (its no-position branch falls back to
// whatever the CURRENT selection already is, and defers the actual DOM
// focus sync to a `requestAnimationFrame` — see node_modules/@tiptap/core's
// commands/focus.ts). Going through that command made this helper's result
// implicitly depend on timing and on whatever selection happened to be live
// at dispatch time, instead of purely on the `ref` the menu was opened on —
// exactly the "collapses into the wrong block" failure mode. Dispatching a
// transaction built straight from `ref.pos` removes that dependency
// entirely, and focusing via the view directly makes it synchronous instead
// of rAF-deferred, closing the window a click right after Escape could land
// in before this ran. Exported so block-context-menu.test.tsx can prove the
// computed selection directly against a headless editor, without depending
// on Radix's real focus/portal lifecycle in jsdom.
export function applyBlockSelection(
  editor: Editor,
  ref: BlockRef,
  options: { focus?: boolean } = {},
): void {
  const { view } = editor;
  const selection = ref.node.isAtom
    ? NodeSelection.create(view.state.doc, ref.pos)
    : TextSelection.create(view.state.doc, ref.pos + 1);
  view.dispatch(view.state.tr.setSelection(selection));
  if (options.focus) view.focus();
}

// 7e2f2ae follow-up (orchestrator activeElement probe): the ENTIRE body of
// the grip menu's `onCloseAutoFocus` — preventDefault, then ONLY
// `editor.view.focus()`. Deliberately not `applyBlockSelection` or any
// other selection-touching call: `handleOpenChange`'s `next === false`
// branch is the one place that already decided and dispatched the correct
// selection, synchronously, before Radix even starts closing; this handler
// runs later (only after Radix's exit animation finishes and unmounts the
// content) and its only remaining job is making DOM focus land now that
// nothing is left to contest it — see the fuller mechanism comment on the
// call site below. Exported (and typed to accept anything with just a
// `preventDefault`, matching Radix's `onCloseAutoFocus` signature) so
// block-context-menu.test.tsx can prove both the call order and that it
// dispatches no transaction, against a real headless editor, without
// mounting Radix in jsdom.
export function handleGripMenuCloseAutoFocus(
  editor: Editor,
  event: Pick<Event, "preventDefault">,
): void {
  event.preventDefault();
  editor.view.focus();
}

export function BlockContextMenu({
  editor,
  getHoveredPos,
  isBlockIdPersisted = () => false,
  children,
}: BlockContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState<BlockRef | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      const pos = getHoveredPos();
      const resolved = pos === null ? null : resolveBlockAt(editor, pos);
      setRef(resolved);
      // Opening the menu used to leave editor.state.selection completely
      // untouched. If the user had a cross-block TextSelection armed
      // beforehand (e.g. Shift+Home from inside a paragraph, spanning up
      // into the previous block), that multi-block selection stayed live in
      // the document for as long as the menu was open — Escape/click-
      // outside closes the menu without ever running a command, so nothing
      // ever cleared it. Collapsing to a selection scoped to THIS block the
      // instant the menu opens means there is no multi-block range left
      // armed by the time the menu closes, regardless of what focus does
      // afterwards. No `.focus()` here on purpose: Radix's own FocusScope is
      // about to move DOM focus into the just-opened menu content, and
      // calling editor.commands.focus() here would fight it.
      if (resolved) applyBlockSelection(editor, resolved);
    } else if (ref) {
      // E3 follow-up (orchestrator repro, editor-pass-e3.md — dadf45c and
      // d29a7dd both still reproduced): the SELECTION half of close-time
      // recovery lives HERE, synchronously, in the exact tick Escape/
      // outside-click closes the menu — `onOpenChange` fires immediately,
      // before Radix even starts its exit animation.
      //
      // Re-resolve at `ref.pos` and only proceed if the SAME node type is
      // still there: an item action (Turn into, Eliminar, …) may have just
      // closed the menu itself after already running its own selection
      // logic for the block it changed or removed (withFreshRef below), and
      // this must never fight that — a type mismatch (or nothing left at
      // that position) means exactly that happened.
      const current = resolveBlockAt(editor, ref.pos);
      if (current && current.node.type === ref.node.type) {
        // 7e2f2ae follow-up (activeElement probe): the `{ focus: true }`
        // DOM focus this call also attempts gets fought right here — Radix's
        // FocusScope is still mounted and re-traps focus while the exit
        // animation plays, so it doesn't reliably stick. That's fine: it's
        // the SELECTION half of the fix, and `applyBlockSelection` always
        // dispatches that synchronously regardless of what focus ends up
        // doing. `handleCloseAutoFocus` below is the ONLY thing responsible
        // for making focus land correctly, once Radix is fully out of the
        // way.
        applyBlockSelection(editor, ref, { focus: true });
      }
    }
    setOpen(next);
  }

  // 7e2f2ae follow-up (orchestrator activeElement probe on 7e2f2ae): Radix's
  // default onCloseAutoFocus returns DOM focus to the trigger (see @radix-
  // ui/react-dropdown-menu's dropdown-menu.tsx —
  // `context.triggerRef.current?.focus()`) — here that trigger is the grip
  // `<button data-testid="block-drag-handle">` in block-handle.tsx, which
  // lives inside @tiptap/extension-drag-handle-react's own floating wrapper,
  // OUTSIDE the editor's contentEditable DOM subtree. `preventDefault()`
  // alone (7e2f2ae) stopped that, but left NOTHING focused at all — Radix's
  // FocusScope had already fought `handleOpenChange`'s own `view.focus()`
  // attempt while it was still mounted (see the comment above), and by the
  // time this callback runs (Radix only invokes it AFTER the exit animation
  // finishes and the content unmounts) that scope is gone — so this is the
  // one moment nothing is left to contest a focus call. `editor.view.focus()`
  // is ProseMirror's own synchronous focus (no `requestAnimationFrame`, no
  // Tiptap command); called here, it writes the selection `handleOpenChange`
  // already collapsed into the DOM. That in turn means ProseMirror's own
  // "focus" handler (prosemirror-view's input.ts: on focus, if the DOM
  // selection it finds doesn't match `state.selection`, it corrects the DOM
  // after a short delay) has nothing to correct — the DOM already agrees.
  // More importantly, the editor is now the activeElement BEFORE the user's
  // next click, so that click never fires a fresh "focus" event on it at
  // all, and that delayed correction is never scheduled in the first place
  // — this is what actually closes the 7e2f2ae race (a later click landing
  // inside that correction's short window). No selection logic belongs
  // here: `handleOpenChange` already owns that, and duplicating it here
  // would just reintroduce a second, later writer for the same value.
  //
  // `preventDefault()` runs first so Radix's own default (composed to run
  // AFTER this prop handler, and skipped once the event is marked
  // defaulted) never fires — see block-context-menu.test.tsx for both the
  // call order and that this never dispatches a transaction. Delegates to
  // the exported `handleGripMenuCloseAutoFocus` so that proof can run
  // against a real headless editor without mounting Radix in jsdom.
  function handleCloseAutoFocus(event: Event) {
    handleGripMenuCloseAutoFocus(editor, event);
  }

  // Re-resolves from the live document right before running a command too
  // — `ref` is a snapshot taken when the menu opened, and a remote
  // reconciliation could in principle land while it's still open.
  function withFreshRef(run: (fresh: BlockRef) => void) {
    if (!ref) return;
    const fresh = resolveBlockAt(editor, ref.pos);
    if (!fresh) return;
    run(fresh);
    // 7e2f2ae follow-up: every menu row (Turn into, Colores, Copiar,
    // Duplicar, Copiar enlace, Descargar, Restablecer formato, Eliminar)
    // closes the menu through here — the same synchronous re-focus
    // `handleCloseAutoFocus` does for Escape/outside-click, applied right
    // where the action itself just ran instead of waiting for Radix's
    // later callback. Harmless if `run` already focused the editor itself
    // (block-actions.ts's own functions do, for their OTHER caller —
    // extensions/block-shortcuts.ts's keyboard shortcuts, which never go
    // through this menu at all): `view.focus()` is idempotent.
    editor.view.focus();
  }

  const isImage = ref?.node.type.name === "image";
  const blockId = ref ? blockLinkId(ref) : null;
  const canCopyLink = blockId !== null && isBlockIdPersisted(blockId);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-56 rounded-xl p-1 shadow-md"
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-[13.5px]">
            <Type aria-hidden="true" size={16} strokeWidth={1.75} />
            Convertir en
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-48 rounded-xl p-1">
            {BLOCK_KIND_ITEMS.map((kind) => (
              <DropdownMenuItem
                key={kind.id}
                className="gap-2 text-[13.5px]"
                onSelect={() =>
                  withFreshRef((fresh) => {
                    applyBlockSelection(editor, fresh);
                    kind.run(editor);
                  })
                }
              >
                <kind.icon aria-hidden="true" size={16} strokeWidth={1.75} />
                {kind.label}
                {ref && kind.isActive(editor) && (
                  <DropdownMenuShortcut>✓</DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-[13.5px]">
            <Palette aria-hidden="true" size={16} strokeWidth={1.75} />
            Colores
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-56 rounded-xl p-2">
            <DropdownMenuLabel className="px-0.5">Texto</DropdownMenuLabel>
            <div className="mb-2 flex flex-wrap gap-1 px-0.5">
              {TEXT_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  aria-label={swatch.label}
                  title={swatch.label}
                  data-testid={`block-menu-text-color-${swatch.id}`}
                  className="flex size-7 items-center justify-center rounded-md outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    withFreshRef((fresh) =>
                      applyBlockTextColor(editor, fresh, swatch.id),
                    )
                  }
                >
                  <SwatchDot swatch={swatch} />
                </button>
              ))}
            </div>
            <DropdownMenuLabel className="px-0.5">Fondo</DropdownMenuLabel>
            <div className="flex flex-wrap gap-1 px-0.5">
              {BACKGROUND_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  aria-label={swatch.label}
                  title={swatch.label}
                  data-testid={`block-menu-background-${swatch.id}`}
                  className="flex size-7 items-center justify-center rounded-md outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    withFreshRef((fresh) =>
                      applyBlockBackground(editor, fresh, swatch.id),
                    )
                  }
                >
                  <SwatchDot swatch={swatch} />
                </button>
              ))}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 text-[13.5px]"
          onSelect={() => withFreshRef((fresh) => copyBlock(editor, fresh))}
        >
          <Copy aria-hidden="true" size={16} strokeWidth={1.75} />
          Copiar
          <DropdownMenuShortcut>⌘⇧C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-[13.5px]"
          onSelect={() =>
            withFreshRef((fresh) => duplicateBlock(editor, fresh))
          }
        >
          <ClipboardCopy aria-hidden="true" size={16} strokeWidth={1.75} />
          Duplicar
          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
        </DropdownMenuItem>
        {canCopyLink && (
          <DropdownMenuItem
            className="gap-2 text-[13.5px]"
            onSelect={() => withFreshRef((fresh) => copyBlockLink(fresh))}
          >
            <LinkIcon aria-hidden="true" size={16} strokeWidth={1.75} />
            Copiar enlace
          </DropdownMenuItem>
        )}
        {isImage && (
          <DropdownMenuItem
            className="gap-2 text-[13.5px]"
            onSelect={() =>
              withFreshRef((fresh) => {
                const dom = editor.view.nodeDOM(fresh.pos);
                const img =
                  dom instanceof HTMLElement
                    ? dom.querySelector<HTMLImageElement>(
                        '[data-testid="image-node-img"]',
                      )
                    : null;
                if (!img?.src) return;
                const link = document.createElement("a");
                link.href = img.src;
                link.download = "";
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.click();
              })
            }
          >
            <Download aria-hidden="true" size={16} strokeWidth={1.75} />
            Descargar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="gap-2 text-[13.5px]"
          onSelect={() =>
            withFreshRef((fresh) => resetBlockFormatting(editor, fresh))
          }
        >
          <Eraser aria-hidden="true" size={16} strokeWidth={1.75} />
          Restablecer formato
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          className="gap-2 text-[13.5px]"
          onSelect={() => withFreshRef((fresh) => deleteBlock(editor, fresh))}
        >
          <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
          Eliminar
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
