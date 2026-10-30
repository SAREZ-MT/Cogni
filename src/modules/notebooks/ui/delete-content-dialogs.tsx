"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { DeleteConfirmDialog } from "@/shared/ui/delete-confirm-dialog";
import { deletionSummary } from "@/shared/ui/deletion-summary";
import {
  deleteNotebook as deleteNotebookAction,
  deletePage as deletePageAction,
  previewNotebookDeletion,
  previewPageDeletion,
} from "../actions";
import { NOTEBOOK_ERROR, NOTEBOOKS_ERROR, PAGE_ERROR } from "../domain/errors";

// Spanish copy per ActionError code of the delete actions; anything else
// falls back to the dialog's generic failure.
const ERROR_COPY: Record<string, string> = {
  [NOTEBOOK_ERROR.NOT_FOUND]: "Este cuaderno ya no existe.",
  [PAGE_ERROR.NOT_FOUND]: "Esta página ya no existe.",
  [NOTEBOOKS_ERROR.SESSION_REQUIRED]:
    "Tu sesión expiró. Inicia sesión de nuevo.",
};
const GENERIC_FAILURE = "No pudimos eliminarlo. Inténtalo de nuevo.";

function reasonFor(result: { ok: boolean; error?: { code: string } }) {
  if (result.ok) return null;
  return ERROR_COPY[result.error?.code ?? ""] ?? GENERIC_FAILURE;
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // After the delete committed and the dialog closed.
  onDeleted: () => void;
}

// Phase 8 H19: deleting a notebook removes it with every page and all
// their study material; the counts come from the server when it opens.
export function DeleteNotebookDialog({
  notebook,
  ...props
}: DeleteDialogProps & { notebook: { id: string; title: string } }) {
  return (
    <DeleteConfirmDialog
      {...props}
      testId="delete-notebook-dialog"
      title={`¿Eliminar el cuaderno «${notebook.title}»?`}
      confirmLabel="Eliminar cuaderno"
      emptySummary="Se eliminará el cuaderno. Todavía no tiene páginas."
      loadSummary={async () => {
        const result = await previewNotebookDeletion({
          notebookId: notebook.id,
        });
        if (!result.ok) throw new Error(result.error.code);
        const { pages, decks, recallSets, examSets } = result.value;
        return deletionSummary([
          { count: pages, one: "página", many: "páginas" },
          { count: decks, one: "mazo", many: "mazos" },
          {
            count: recallSets,
            one: "repaso activo",
            many: "repasos activos",
          },
          { count: examSets, one: "examen", many: "exámenes" },
        ]);
      }}
      onConfirm={async () =>
        reasonFor(await deleteNotebookAction({ notebookId: notebook.id }))
      }
    />
  );
}

// Phase 8 H19: deleting a page removes its notes, images and every
// technique's items with their history.
export function DeletePageDialog({
  page,
  ...props
}: DeleteDialogProps & { page: { id: string; title: string } }) {
  return (
    <DeleteConfirmDialog
      {...props}
      testId="delete-page-dialog"
      title={`¿Eliminar la página «${page.title}»?`}
      confirmLabel="Eliminar página"
      emptySummary="Se eliminarán la página y sus apuntes."
      loadSummary={async () => {
        const result = await previewPageDeletion({ pageId: page.id });
        if (!result.ok) throw new Error(result.error.code);
        const { flashcards, recallQuestions, examQuestions, images } =
          result.value;
        const study = deletionSummary([
          { count: flashcards, one: "tarjeta", many: "tarjetas" },
          {
            count: recallQuestions,
            one: "pregunta de repaso activo",
            many: "preguntas de repaso activo",
          },
          {
            count: examQuestions,
            one: "pregunta de examen",
            many: "preguntas de examen",
          },
          { count: images, one: "imagen", many: "imágenes" },
        ]);
        return study
          ? study.replace(/^Se eliminarán? /, "Se eliminarán sus apuntes, ")
          : null;
      }}
      onConfirm={async () =>
        reasonFor(await deletePageAction({ pageId: page.id }))
      }
    />
  );
}

// The page card's trash button (notebook route grid and list, Phase 8
// H19): opens the delete confirmation; the route stays and refreshes.
export function DeletePageButton({
  pageId,
  title,
  className,
}: {
  pageId: string;
  title: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Eliminar página ${title}`}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" size={14} />
      </Button>
      <DeletePageDialog
        page={{ id: pageId, title }}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => router.refresh()}
      />
    </>
  );
}
