"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
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
}: ChangeAppearanceDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apariencia de {notebookTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              onClick={() => {
                onChange(color);
                setOpen(false);
              }}
              className={cn(
                "size-8 rounded-full transition-transform hover:scale-105",
                DOT_CLASSES[color],
                // Legacy notebooks without a stored color preview as violet
                // (same fallback as the icon tiles), so the ring still
                // highlights the color the tile actually renders.
                (currentColor ?? "purple") === color &&
                  "ring-2 ring-ring ring-offset-2",
              )}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
