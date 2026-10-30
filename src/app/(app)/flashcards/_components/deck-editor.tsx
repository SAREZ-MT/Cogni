"use client";

import {
  type FlashcardView,
  MAX_FLASHCARD_SIDE_LENGTH,
  saveDeckEditsAction,
} from "@/modules/flashcards";
import { ItemEditor, type ItemErrors } from "@/shared/ui/item-editor";
import { ItemField, invalidProps } from "@/shared/ui/item-field";
import { Textarea } from "@/shared/ui/textarea";

export interface CardSides {
  front: string;
  back: string;
}

export interface DeckEditorProps {
  pageId: string;
  cards: readonly FlashcardView[];
}

const SAVE_ERRORS: Record<string, string> = {
  FLASHCARD_LAST_CARD:
    "El mazo necesita al menos una tarjeta. Para quitarlo entero, usa Eliminar mazo en Flashcards.",
  FLASHCARD_EMPTY: "Cada tarjeta necesita frente y reverso.",
  FLASHCARD_TOO_LONG: `Cada lado admite hasta ${MAX_FLASHCARD_SIDE_LENGTH} caracteres.`,
  FLASHCARD_CHANGED:
    "Una tarjeta cambió en otra pestaña. Recarga la página para ver la última versión.",
  FLASHCARD_NOT_FOUND:
    "Este mazo cambió mientras lo editabas. Recarga la página e intenta de nuevo.",
  PAGE_NOT_FOUND: "Esta página ya no existe.",
  FLASHCARDS_SESSION_REQUIRED: "Tu sesión expiró. Inicia sesión de nuevo.",
};
const SAVE_FAILED = "No pudimos guardar los cambios. Intenta de nuevo.";

function sideError(text: string, empty: string): string | undefined {
  if (text.trim() === "") return empty;
  if (text.trim().length > MAX_FLASHCARD_SIDE_LENGTH) {
    return `Máximo ${MAX_FLASHCARD_SIDE_LENGTH} caracteres.`;
  }
  return undefined;
}

export function validateCard(card: CardSides): ItemErrors {
  const errors: ItemErrors = {};
  const front = sideError(card.front, "Escribe el frente de la tarjeta.");
  const back = sideError(card.back, "Escribe el reverso de la tarjeta.");
  if (front) errors.front = front;
  if (back) errors.back = back;
  return errors;
}

// `version` goes back with an edit, so a save over a newer change of the
// card (another tab) is refused (V10).
const toItem = (card: FlashcardView) => ({
  id: card.id,
  value: { front: card.front, back: card.back },
  version: card.updatedAt,
});

// The deck's edit page (Phase 8 H18): front and back of every card, new
// cards and real deletions, saved together by saveDeckEditsAction.
export function DeckEditor({ pageId, cards }: DeckEditorProps) {
  return (
    <ItemEditor<CardSides>
      items={cards.map(toItem)}
      itemLabel="Tarjeta"
      addLabel="Añadir tarjeta"
      lastItemMessage="El mazo necesita al menos una tarjeta. Para quitarlo entero, usa Eliminar mazo en Flashcards."
      emptyValue={() => ({ front: "", back: "" })}
      validate={validateCard}
      renderFields={({ value, onChange, errors, idPrefix }) => (
        <div className="grid gap-3 md:grid-cols-2">
          <ItemField
            id={`${idPrefix}-front`}
            label="Frente"
            error={errors.front}
          >
            <Textarea
              id={`${idPrefix}-front`}
              value={value.front}
              onChange={(event) =>
                onChange({ ...value, front: event.target.value })
              }
              placeholder="La pregunta o el concepto"
              className="rounded-input px-3.5 py-2.5"
              {...invalidProps(`${idPrefix}-front`, errors.front)}
            />
          </ItemField>
          <ItemField
            id={`${idPrefix}-back`}
            label="Reverso"
            error={errors.back}
          >
            <Textarea
              id={`${idPrefix}-back`}
              value={value.back}
              onChange={(event) =>
                onChange({ ...value, back: event.target.value })
              }
              placeholder="La respuesta"
              className="rounded-input px-3.5 py-2.5"
              {...invalidProps(`${idPrefix}-back`, errors.back)}
            />
          </ItemField>
        </div>
      )}
      onSave={async (operations) => {
        const result = await saveDeckEditsAction({
          pageId,
          ...operations,
          updates: operations.updates.map(({ version, ...update }) => ({
            ...update,
            expectedUpdatedAt: version,
          })),
        });
        if (result.ok)
          return { ok: true, items: result.value.cards.map(toItem) };
        return {
          ok: false,
          message: SAVE_ERRORS[result.error.code] ?? SAVE_FAILED,
        };
      }}
    />
  );
}
