"use client";

import { MoreHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { StatusBanner } from "@/shared/ui/status-banner";
import {
  archiveNotebook as archiveNotebookAction,
  renameNotebook as renameNotebookAction,
  setNotebookAppearance as setNotebookAppearanceAction,
} from "../actions";
import type { NotebookColor } from "../domain/notebook";
import { ArchiveConfirmDialog } from "./archive-confirm-dialog";
import { ChangeAppearanceDialog } from "./change-appearance-dialog";
import { useNotebookActionsSlot } from "./notebook-actions-slot";
import { RenameNotebookDialog } from "./rename-notebook-dialog";

// The notebook Server Actions throw when they fail. Each failure becomes this
// message (Spanish product copy) in an accessible alert, instead of an
// unhandled transition rejection that bubbled to the error boundary.
const FAILURE_COPY = {
  rename: "No se pudo renombrar el cuaderno",
  appearance: "No se pudo cambiar la apariencia del cuaderno",
  archive: "No se pudo archivar el cuaderno",
} as const;

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
  const slot = useNotebookActionsSlot();
  const [menuOpen, setMenuOpen] = useState(false);

  // The dialogs below live inside the menu content and keep it open while
  // they are showing (see the preventDefault note above), so the menu has to
  // be closed explicitly once a dialog goes away.
  function closeMenuWhenDialogCloses(open: boolean) {
    if (!open) setMenuOpen(false);
  }

  const [failure, setFailure] = useState<string | null>(null);

  // Runs one mutation inside a transition; a rejection is shown, not thrown,
  // and only a success refreshes the Server Component data.
  function run(failureTitle: string, action: () => Promise<unknown>) {
    setFailure(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setFailure(failureTitle);
        return;
      }
      router.refresh();
    });
  }

  function rename(title: string) {
    run(FAILURE_COPY.rename, () =>
      renameNotebookAction({ notebookId: notebook.id, title }),
    );
  }

  function changeAppearance(color: NotebookColor) {
    run(FAILURE_COPY.appearance, () =>
      setNotebookAppearanceAction({
        notebookId: notebook.id,
        icon: notebook.icon,
        color,
      }),
    );
  }

  function archive() {
    run(FAILURE_COPY.archive, () =>
      archiveNotebookAction({ notebookId: notebook.id }),
    );
  }

  return (
    <>
      {failure
        ? // Portaled to <body>: the card lifts with a transform on hover,
          // which would otherwise anchor a `fixed` banner to the card.
          createPortal(
            <StatusBanner
              role="alert"
              tone="error"
              title={failure}
              description="Inténtalo de nuevo en unos segundos."
              className="fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-card shadow-md"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Cerrar aviso"
                  onClick={() => setFailure(null)}
                >
                  <X aria-hidden="true" size={14} strokeWidth={1.75} />
                </Button>
              }
            />,
            document.body,
          )
        : null}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
            onOpenChange={closeMenuWhenDialogCloses}
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
            onOpenChange={closeMenuWhenDialogCloses}
            trigger={
              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                Cambiar apariencia
              </DropdownMenuItem>
            }
          />
          {/* Items other modules inject through the slot (PDF import from
            `ingestion`, wired in src/app/(app)/_components/notebook-actions.tsx);
            `notebooks` never imports them. */}
          {slot.menuItems?.(
            { id: notebook.id, title: notebook.title },
            {
              refreshTree: () => router.refresh(),
            },
          )}
          <ArchiveConfirmDialog
            itemLabel={`el cuaderno "${notebook.title}"`}
            onConfirm={archive}
            onOpenChange={closeMenuWhenDialogCloses}
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
    </>
  );
}
