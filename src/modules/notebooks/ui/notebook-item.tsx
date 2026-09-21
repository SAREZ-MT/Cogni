"use client";

import { FilePlus, Notebook as NotebookIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/ui/utils";
import type { SidebarNotebook } from "../application/list-sidebar";
import { COLOR_PALETTE, type NotebookColor } from "../domain/notebook";
import { ArchiveConfirmDialog } from "./archive-confirm-dialog";
import { PageItem } from "./page-item";

// Tailwind (v4) needs literal class names to keep them in the generated
// CSS; a template-interpolated `bg-${color}` string is invisible to its
// scanner. This map is the only place that spells out the Cogni pastel
// palette utilities (src/app/globals.css, "--color-pastel-*"); no hex
// values ever appear in a component (docs/design-system).
const SWATCH_CLASSES: Record<NotebookColor, string> = {
  pink: "bg-pastel-pink text-pastel-pink-fg",
  green: "bg-pastel-green text-pastel-green-fg",
  yellow: "bg-pastel-yellow text-pastel-yellow-fg",
  purple: "bg-pastel-purple text-pastel-purple-fg",
  orange: "bg-pastel-orange text-pastel-orange-fg",
  blue: "bg-pastel-blue text-pastel-blue-fg",
  mint: "bg-pastel-mint text-pastel-mint-fg",
};
const DOT_CLASSES: Record<NotebookColor, string> = {
  pink: "bg-pastel-pink",
  green: "bg-pastel-green",
  yellow: "bg-pastel-yellow",
  purple: "bg-pastel-purple",
  orange: "bg-pastel-orange",
  blue: "bg-pastel-blue",
  mint: "bg-pastel-mint",
};

interface NotebookItemProps {
  notebook: SidebarNotebook;
  onRename: (title: string) => void;
  onSetAppearance: (icon: string | null, color: NotebookColor | null) => void;
  onArchive: () => void;
  onCreatePage: () => void;
  onRenamePage: (pageId: string, title: string) => void;
  onArchivePage: (pageId: string) => void;
}

// One row per active notebook plus its active pages, ordered by position
// (specs/notebooks/spec.md, "Listado del sidebar"). Rename is inline
// (double-click the title); appearance changes through the color popover
// (Scenario "Renombrar y cambiar ícono desde el sidebar").
export function NotebookItem({
  notebook,
  onRename,
  onSetAppearance,
  onArchive,
  onCreatePage,
  onRenamePage,
  onArchivePage,
}: NotebookItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(notebook.title);

  function commit() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== notebook.title) onRename(trimmed);
    else setTitle(notebook.title);
  }

  return (
    <li className="flex flex-col gap-0.5">
      <div className="group/notebook flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Cambiar apariencia de ${notebook.title}`}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-input text-base",
                notebook.color
                  ? SWATCH_CLASSES[notebook.color]
                  : "text-fg-secondary",
              )}
            >
              {notebook.icon ?? (
                <NotebookIcon aria-hidden="true" size={16} strokeWidth={1.75} />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto gap-1 p-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                onClick={() => onSetAppearance(notebook.icon, color)}
                className={cn(
                  "size-6 rounded-full",
                  DOT_CLASSES[color],
                  notebook.color === color && "ring-2 ring-ring ring-offset-1",
                )}
              />
            ))}
          </PopoverContent>
        </Popover>

        {editing ? (
          <input
            // biome-ignore lint/a11y/noAutofocus: user just triggered inline rename by double-clicking the title; focus must move to the new input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
                setTitle(notebook.title);
                setEditing(false);
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-input border border-border-default bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            className="h-8 min-w-0 flex-1 truncate rounded-input px-2 text-left font-medium text-fg text-sm"
          >
            {notebook.title}
          </button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onCreatePage}
          aria-label={`Crear página en ${notebook.title}`}
          className="opacity-0 group-hover/notebook:opacity-100"
        >
          <FilePlus aria-hidden="true" size={14} />
        </Button>
        <ArchiveConfirmDialog
          itemLabel={`el cuaderno "${notebook.title}"`}
          onConfirm={onArchive}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover/notebook:opacity-100"
              aria-label={`Archivar cuaderno ${notebook.title}`}
            >
              <Trash2 aria-hidden="true" size={14} />
            </Button>
          }
        />
      </div>

      {notebook.pages.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {notebook.pages.map((page) => (
            <PageItem
              key={page.id}
              notebookId={notebook.id}
              page={page}
              onRename={(title) => onRenamePage(page.id, title)}
              onArchive={() => onArchivePage(page.id)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
