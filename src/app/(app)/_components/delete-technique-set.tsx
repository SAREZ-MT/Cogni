"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useState } from "react";
import {
  deleteRecallSetAction,
  previewRecallSetDeletionAction,
} from "@/modules/active-recall";
import {
  deleteExamSetAction,
  previewExamSetDeletionAction,
} from "@/modules/exams";
import {
  deleteDeckAction,
  previewDeckDeletionAction,
} from "@/modules/flashcards";
import { DeleteConfirmDialog } from "@/shared/ui/delete-confirm-dialog";
import { deletionSummary } from "@/shared/ui/deletion-summary";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";

export type TechniqueSetKind = "deck" | "recall" | "exam";

type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string } };

interface KindCopy {
  item: string;
  title: (title: string) => string;
  empty: string;
  notFound: string;
  summary: () => Promise<string | null>;
  remove: () => Promise<Outcome<unknown>>;
}

function unwrap<T>(result: Outcome<T>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

// The three hub cards' sets (Phase 8 H19): label, Spanish copy and the
// module actions reading and deleting each.
function kindCopy(kind: TechniqueSetKind, pageId: string): KindCopy {
  const input = { pageId };
  switch (kind) {
    case "deck":
      return {
        item: "Eliminar mazo",
        title: (title) => `¿Eliminar el mazo «${title}»?`,
        empty: "Se eliminará el mazo.",
        notFound: "Este mazo ya no existe.",
        summary: async () => {
          const { cards, reviews } = unwrap(
            await previewDeckDeletionAction(input),
          );
          return deletionSummary([
            { count: cards, one: "tarjeta", many: "tarjetas" },
            { count: reviews, one: "repaso", many: "repasos" },
          ]);
        },
        remove: () => deleteDeckAction(input),
      };
    case "recall":
      return {
        item: "Eliminar repaso",
        title: (title) => `¿Eliminar el repaso activo «${title}»?`,
        empty: "Se eliminará el repaso activo.",
        notFound: "Este repaso ya no existe.",
        summary: async () => {
          const { questions, sessions } = unwrap(
            await previewRecallSetDeletionAction(input),
          );
          return deletionSummary([
            { count: questions, one: "pregunta", many: "preguntas" },
            { count: sessions, one: "sesión", many: "sesiones" },
          ]);
        },
        remove: () => deleteRecallSetAction(input),
      };
    case "exam":
      return {
        item: "Eliminar examen",
        title: (title) => `¿Eliminar el examen «${title}»?`,
        empty: "Se eliminará el examen.",
        notFound: "Este examen ya no existe.",
        summary: async () => {
          const { questions, attempts } = unwrap(
            await previewExamSetDeletionAction(input),
          );
          return deletionSummary([
            { count: questions, one: "pregunta", many: "preguntas" },
            { count: attempts, one: "intento", many: "intentos" },
          ]);
        },
        remove: () => deleteExamSetAction(input),
      };
  }
}

const SESSION_EXPIRED = "Tu sesión expiró. Inicia sesión de nuevo.";

const OpenDelete = createContext<{
  open: () => void;
  item: string;
  kind: TechniqueSetKind;
} | null>(null);

// Phase 8 H19 (replaces H17's DeleteDeck): "Eliminar mazo / repaso /
// examen" of a technique hub card deletes the page's whole set for real.
// The provider wraps the card and owns the confirmation, so the dialog
// lives outside the kebab menu and survives it closing; the menu item only
// opens it. After the delete the hub refreshes and the card is gone.
export function DeleteTechniqueSetProvider({
  kind,
  pageId,
  title,
  children,
}: {
  kind: TechniqueSetKind;
  pageId: string;
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const copy = kindCopy(kind, pageId);

  return (
    <OpenDelete.Provider
      value={{ open: () => setOpen(true), item: copy.item, kind }}
    >
      {children}
      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        testId={`delete-${kind}-dialog`}
        title={copy.title(title)}
        confirmLabel={copy.item}
        emptySummary={copy.empty}
        loadSummary={copy.summary}
        onConfirm={async () => {
          const result = await copy.remove();
          if (result.ok) return null;
          return result.error.code.endsWith("SESSION_REQUIRED")
            ? SESSION_EXPIRED
            : result.error.code.endsWith("NOT_FOUND")
              ? copy.notFound
              : "No pudimos eliminarlo. Inténtalo de nuevo.";
        }}
        onDeleted={() => router.refresh()}
      />
    </OpenDelete.Provider>
  );
}

// The kebab's destructive item; opens its provider's confirmation.
export function DeleteTechniqueSetMenuItem() {
  const context = useContext(OpenDelete);
  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() => context?.open()}
      data-testid={`delete-${context?.kind ?? "set"}-item`}
    >
      <Trash2 aria-hidden="true" size={15} strokeWidth={1.75} />
      {context?.item ?? "Eliminar"}
    </DropdownMenuItem>
  );
}
