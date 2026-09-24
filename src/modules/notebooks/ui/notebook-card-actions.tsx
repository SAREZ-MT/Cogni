"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  archiveNotebook as archiveNotebookAction,
  renameNotebook as renameNotebookAction,
  setNotebookAppearance as setNotebookAppearanceAction,
} from "../actions";
import type { NotebookColor } from "../domain/notebook";
import { ArchiveConfirmDialog } from "./archive-confirm-dialog";
import { ChangeAppearanceDialog } from "./change-appearance-dialog";
import { RenameNotebookDialog } from "./rename-notebook-dialog";

interface NotebookCardActionsProps {
  notebook: {
    id: string;
    title: string;
    icon: string | null;
    color: NotebookColor | null;
  };
  className?: string;
}

// "Acciones de {título}" kebab, reused by the /notebooks grid and list
// screens and by Home's "Mis cuadernos" grid (notebook-card.tsx,
// notebook-list-row.tsx): rename, change appearance and archive reuse the
// exact same Server Actions and ArchiveConfirmDialog the sidebar tree's
// NotebookItem already used (design pass 2, "reuse the existing
// components/actions ... rather than rewriting logic"). These screens are
// Server Components re-fetched on navigation, not a live TanStack Query
// cache like the sidebar tree, so every mutation here just calls
// router.refresh() afterward — the same pattern CreateNotebookTrigger uses.
// Each DropdownMenuItem that opens a nested Dialog calls
// `event.preventDefault()` in onSelect: Radix's Dialog content renders into
// its own portal, so it survives the dropdown closing, but without
// preventDefault the dropdown's default close-on-select would fire a
// pointerdown-outside on the Dialog in the same tick, in some browsers.
export function NotebookCardActions({
  notebook,
  className,
}: NotebookCardActionsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function rename(title: string) {
    startTransition(async () => {
      await renameNotebookAction({ notebookId: notebook.id, title });
      router.refresh();
    });
  }

  function changeAppearance(color: NotebookColor) {
    startTransition(async () => {
      await setNotebookAppearanceAction({
        notebookId: notebook.id,
        icon: notebook.icon,
        color,
      });
      router.refresh();
    });
  }

  function archive() {
    startTransition(async () => {
      await archiveNotebookAction({ notebookId: notebook.id });
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Acciones de ${notebook.title}`}
          className={className}
          onClick={(event) => {
            // notebook-card.tsx/notebook-list-row.tsx render this inside a
            // Link wrapping the whole card: stop the click from also
            // triggering navigation.
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <MoreHorizontal aria-hidden="true" size={14} strokeWidth={1.75} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <RenameNotebookDialog
          initialTitle={notebook.title}
          onRename={rename}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Renombrar
            </DropdownMenuItem>
          }
        />
        <ChangeAppearanceDialog
          notebookTitle={notebook.title}
          currentColor={notebook.color}
          onChange={changeAppearance}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Cambiar apariencia
            </DropdownMenuItem>
          }
        />
        <ArchiveConfirmDialog
          itemLabel={`el cuaderno "${notebook.title}"`}
          onConfirm={archive}
          trigger={
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => event.preventDefault()}
            >
              Archivar
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
