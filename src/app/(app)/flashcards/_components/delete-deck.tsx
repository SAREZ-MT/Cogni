"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useTransition,
} from "react";
import { archiveDeckAction } from "@/modules/flashcards";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { FormMessage } from "@/shared/ui/form-message";

const GENERIC_FAILURE = "No pudimos eliminar el mazo. Intenta de nuevo.";

// Spanish copy per ActionError code of archiveDeckAction; anything else
// falls back to GENERIC_FAILURE.
const ERROR_COPY: Record<string, string> = {
  FLASHCARD_NOT_FOUND: "Este mazo ya no existe.",
  FLASHCARDS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
};

const OpenDeleteDeck = createContext<(() => void) | null>(null);

// "Eliminar mazo" of a flashcards hub card (Phase 8 H17). The provider
// wraps the card and owns the confirmation Dialog (never a native browser
// dialog), so the dialog lives outside the kebab menu and survives it
// closing; the menu item only opens it. Confirming archives every card of
// the deck (archiveDeckAction) and refreshes the hub; a failure keeps the
// dialog open with the reason.
export function DeleteDeckProvider({
  pageId,
  deckTitle,
  children,
}: {
  pageId: string;
  deckTitle: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof archiveDeckAction>>;
      try {
        result = await archiveDeckAction({ pageId });
      } catch {
        setError(GENERIC_FAILURE);
        return;
      }
      if (!result.ok) {
        setError(ERROR_COPY[result.error.code] ?? GENERIC_FAILURE);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <OpenDeleteDeck.Provider value={() => changeOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent data-testid="delete-deck-dialog">
          <DialogHeader>
            <DialogTitle>¿Eliminar el mazo «{deckTitle}»?</DialogTitle>
            <DialogDescription>
              Sus tarjetas salen de tus repasos. La página y sus apuntes no
              cambian.
            </DialogDescription>
          </DialogHeader>
          {error && <FormMessage>{error}</FormMessage>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => changeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirm}
              disabled={pending}
            >
              {pending ? "Eliminando…" : "Eliminar mazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OpenDeleteDeck.Provider>
  );
}

// The kebab's "Eliminar mazo" item; opens its provider's confirmation.
export function DeleteDeckMenuItem() {
  const openDialog = useContext(OpenDeleteDeck);
  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() => openDialog?.()}
      data-testid="delete-deck-item"
    >
      <Trash2 aria-hidden="true" size={15} strokeWidth={1.75} />
      Eliminar mazo
    </DropdownMenuItem>
  );
}
