"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/ui/utils";
import { COLOR_PALETTE, type NotebookColor } from "../domain/notebook";

// Tailwind (v4) needs literal class names; same constraint as notebook-
// item.tsx's own DOT_CLASSES, duplicated here rather than shared across the
// module boundary the way notebook-item.tsx explains for SWATCH_CLASSES.
const DOT_CLASSES: Record<NotebookColor, string> = {
  pink: "bg-pastel-pink",
  green: "bg-pastel-green",
  yellow: "bg-pastel-yellow",
  purple: "bg-pastel-purple",
  orange: "bg-pastel-orange",
  blue: "bg-pastel-blue",
  mint: "bg-pastel-mint",
};

interface ChangeAppearanceDialogProps {
  notebookTitle: string;
  currentColor: NotebookColor | null;
  onChange: (color: NotebookColor) => void;
  trigger: React.ReactNode;
  // Fires on every open/close, including the close after picking a color, so
  // a host menu can close together with the dialog.
  onOpenChange?: (open: boolean) => void;
}

// Design pass 2: a Dialog (not notebook-item.tsx's Popover) so it composes
// safely as a DropdownMenuItem's nested trigger (notebook-card-actions.tsx)
// without the Popover-inside-DropdownMenu portal/focus conflicts that
// pattern is known for. Same COLOR_PALETTE and mutation the sidebar tree's
// popover already used — only the trigger chrome changes.
export function ChangeAppearanceDialog({
  notebookTitle,
  currentColor,
  onChange,
  trigger,
  onOpenChange,
}: ChangeAppearanceDialogProps) {
  const [open, setOpenState] = useState(false);

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apariencia de {notebookTitle}</DialogTitle>
          <DialogDescription>Elige el color de su portada.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-3">
          {COLOR_PALETTE.map((color) => {
            // Legacy notebooks without a stored color preview as violet
            // (same fallback as the icon tiles), so the ring still
            // highlights the color the tile actually renders.
            const current = (currentColor ?? "purple") === color;
            return (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                aria-pressed={current}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-fg-secondary shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 motion-reduce:transform-none",
                  DOT_CLASSES[color],
                  current && "ring-2 ring-primary-500 ring-offset-2",
                )}
              >
                {current && (
                  <Check aria-hidden="true" size={16} strokeWidth={2.25} />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
