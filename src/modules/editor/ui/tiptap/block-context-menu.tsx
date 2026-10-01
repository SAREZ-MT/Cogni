"use client";

// E2 scope A: the drag-handle's "⋮⋮" context menu — clicking the grip
// (block-handle.tsx) opens this instead of only dragging. Styled with the
// shared `dropdown-menu` atom (docs/design-system: white card, radius 12,
// shadow-md), matching the rest of the design system rather than a
// hand-rolled popup.
import type { Editor } from "@tiptap/core";
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
      setRef(pos === null ? null : resolveBlockAt(editor, pos));
    }
    setOpen(next);
  }

  // Re-resolves from the live document right before running a command too
  // — `ref` is a snapshot taken when the menu opened, and a remote
  // reconciliation could in principle land while it's still open.
  function withFreshRef(run: (fresh: BlockRef) => void) {
    if (!ref) return;
    const fresh = resolveBlockAt(editor, ref.pos);
    if (!fresh) return;
    run(fresh);
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
                    editor
                      .chain()
                      .focus()
                      .setTextSelection(fresh.pos + 1)
                      .run();
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
