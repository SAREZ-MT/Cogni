"use client";

import { ChevronRight, FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";
import type { SidebarPage } from "../application/list-sidebar";
import { DeletePageDialog } from "./delete-content-dialogs";
import { useNotebookActionsSlot } from "./notebook-actions-slot";

interface PageItemProps {
  notebookId: string;
  page: SidebarPage;
  onRename: (title: string) => void;
  // Phase 8 H19: after the page was deleted for real.
  onDeleted: () => void;
}

export function PageItem({
  notebookId,
  page,
  onRename,
  onDeleted,
}: PageItemProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState(page.title);
  const slot = useNotebookActionsSlot();
  const badge = slot.pageBadge?.({ id: page.id });
  const pathname = usePathname();
  const href = `/notebooks/${notebookId}/pages/${page.id}`;
  const active = pathname === href;

  function commit() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== page.title) onRename(trimmed);
    else setTitle(page.title);
  }

  // Decorative connector + 14px file icon (design/shell-look, studyplatform
  // obs 142 PageTree): purely visual, the same on every row regardless of
  // state.
  const rowIcon = (
    <>
      <ChevronRight
        aria-hidden="true"
        size={12}
        strokeWidth={1.75}
        className="shrink-0 text-fg-muted"
      />
      <FileText aria-hidden="true" size={14} strokeWidth={1.75} />
    </>
  );

  return (
    <li className="group/page flex items-center gap-1">
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
      ) : page.pending ? (
        // Optimistic page still carrying its temporary client-only id
        // (sidebar-tree-client.tsx, createPage.onMutate): rendered as a
        // non-link so it can't be navigated to before the real id arrives
        // (navigating early 404s — the Server Action never saw the temp
        // id). Same styling as the link below, minus the href.
        <span
          aria-disabled="true"
          className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-input px-2 py-1 text-fg-secondary text-sm"
        >
          {rowIcon}
          <span className="truncate text-[13px]">{page.title}</span>
        </span>
      ) : (
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          onDoubleClick={(event) => {
            event.preventDefault();
            setEditing(true);
          }}
          className={cn(
            "flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-input px-2 py-1 text-fg-secondary text-sm hover:bg-active hover:text-fg-active",
            active && "bg-active font-medium text-fg-active",
          )}
        >
          {rowIcon}
          <span className="truncate text-[13px]">{page.title}</span>
        </Link>
      )}
      {!editing && (
        <span className="shrink-0 text-muted-foreground text-xs">
          {badge === null || badge === undefined ? null : badge}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="opacity-0 group-hover/page:opacity-100 focus-visible:opacity-100"
        aria-label={`Eliminar página ${page.title}`}
        onClick={() => setDeleting(true)}
      >
        <Trash2 aria-hidden="true" size={14} />
      </Button>
      <DeletePageDialog
        page={{ id: page.id, title: page.title }}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={onDeleted}
      />
    </li>
  );
}
