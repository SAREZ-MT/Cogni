"use client";

import { FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";
import type { SidebarPage } from "../application/list-sidebar";
import { ArchiveConfirmDialog } from "./archive-confirm-dialog";
import { useNotebookActionsSlot } from "./notebook-actions-slot";

interface PageItemProps {
  notebookId: string;
  page: SidebarPage;
  onRename: (title: string) => void;
  onArchive: () => void;
}

export function PageItem({
  notebookId,
  page,
  onRename,
  onArchive,
}: PageItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page.title);
  const slot = useNotebookActionsSlot();
  const badge = slot.pageBadge?.({ id: page.id });

  function commit() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== page.title) onRename(trimmed);
    else setTitle(page.title);
  }

  return (
    <li className="group/page flex items-center gap-1 pl-6">
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
              setTitle(page.title);
              setEditing(false);
            }
          }}
          className="h-8 flex-1 rounded-input border border-border-default bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : (
        <Link
          href={`/notebooks/${notebookId}/pages/${page.id}`}
          onDoubleClick={(event) => {
            event.preventDefault();
            setEditing(true);
          }}
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center gap-2 truncate rounded-input px-2 text-fg-secondary text-sm hover:bg-active hover:text-fg-active",
          )}
        >
          <FileText aria-hidden="true" size={16} strokeWidth={1.75} />
          <span className="truncate">{page.title}</span>
        </Link>
      )}
      {!editing && (
        <span className="shrink-0 text-muted-foreground text-xs">
          {badge === null || badge === undefined ? null : badge}
        </span>
      )}
      <ArchiveConfirmDialog
        itemLabel={`la página "${page.title}"`}
        onConfirm={onArchive}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover/page:opacity-100"
            aria-label={`Archivar página ${page.title}`}
          >
            <Trash2 aria-hidden="true" size={14} />
          </Button>
        }
      />
    </li>
  );
}
