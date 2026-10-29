"use client";

import { Plus, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { FormMessage } from "@/shared/ui/form-message";
import {
  addDraftEntry,
  type DraftEntry,
  type DraftOperations,
  draftChangeCount,
  draftFrom,
  draftOperations,
  isEdited,
  remainingCount,
  removeDraftEntry,
  restoreDraftEntry,
  updateDraftEntry,
} from "@/shared/ui/item-draft";
import { Pill } from "@/shared/ui/pill";
import { StatusBanner } from "@/shared/ui/status-banner";
import { UnsavedChangesGuard } from "@/shared/ui/unsaved-changes-guard";
import { cn } from "@/shared/ui/utils";

// Field name -> inline message.
export type ItemErrors = Partial<Record<string, string>>;

export type ItemSaveOutcome<T> =
  | { ok: true; items: { id: string; value: T }[] }
  | { ok: false; message: string };

export interface ItemEditorProps<T> {
  items: readonly { id: string; value: T }[];
  // "Tarjeta", "Pregunta": numbers each entry and names its delete button.
  itemLabel: string;
  addLabel: string;
  // Shown, without asking the server, when the draft deletes every item.
  lastItemMessage: string;
  emptyValue: () => T;
  validate: (value: T) => ItemErrors;
  // The technique's fields of one entry. `idPrefix` is unique per entry.
  renderFields: (field: {
    value: T;
    onChange: (next: T) => void;
    errors: ItemErrors;
    idPrefix: string;
  }) => ReactNode;
  // "Guardar": the draft reduced to operations, applied by the caller's
  // Server Action in one transaction. Resolves the saved items, or why not.
  onSave: (operations: DraftOperations<T>) => Promise<ItemSaveOutcome<T>>;
}

const INVALID_DRAFT = "Revisa los campos marcados antes de guardar.";
const SAVE_FAILED = "No pudimos guardar los cambios. Intenta de nuevo.";

function changesLabel(count: number): string {
  if (count === 0) return "Sin cambios";
  return count === 1 ? "1 cambio sin guardar" : `${count} cambios sin guardar`;
}

// The shared edit page of the three techniques (Phase 8 H18, user
// 2026-10-29): every item as an editable card; edits, additions ("Añadir")
// and deletions (with "Deshacer") stay a local draft until "Guardar",
// which sends them in one call; "Descartar cambios" puts the stored items
// back. Errors show inline under their field; leaving with unsaved changes
// asks first (UnsavedChangesGuard). After saving the page stays, with the
// saved items and "Cambios guardados". Render it inside the technique's
// `data-technique-theme`.
export function ItemEditor<T>({
  items,
  itemLabel,
  addLabel,
  lastItemMessage,
  emptyValue,
  validate,
  renderFields,
  onSave,
}: ItemEditorProps<T>) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftEntry<T>[]>(() => draftFrom(items));
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);

  const changes = draftChangeCount(draft);
  const dirty = changes > 0;
  const errors = new Map(
    draft
      .filter((entry) => !entry.deleted)
      .map((entry) => [entry.key, validate(entry.value)] as const),
  );
  const hasErrors = [...errors.values()].some(
    (fields) => Object.keys(fields).length > 0,
  );

  // A new entry gets the focus on its first field.
  useEffect(() => {
    if (focusKey === null) return;
    list.current
      ?.querySelector<HTMLElement>(
        `[data-entry-key="${focusKey}"] textarea, [data-entry-key="${focusKey}"] input`,
      )
      ?.focus();
    setFocusKey(null);
  }, [focusKey]);

  function change(next: DraftEntry<T>[]) {
    setDraft(next);
    setSaved(false);
    setMessage(null);
  }

  function add() {
    const next = addDraftEntry(draft, emptyValue());
    change(next);
    setFocusKey(next.at(-1)?.key ?? null);
  }

  function discard() {
    change(draftFrom(items));
    setShowErrors(false);
  }

  async function save() {
    if (!dirty || saving) return;
    if (hasErrors) {
      setShowErrors(true);
      setMessage(INVALID_DRAFT);
      return;
    }
    if (remainingCount(draft) === 0) {
      setMessage(lastItemMessage);
      return;
    }
    setSaving(true);
    setMessage(null);
    let outcome: ItemSaveOutcome<T>;
    try {
      outcome = await onSave(draftOperations(draft));
    } catch {
      outcome = { ok: false, message: SAVE_FAILED };
    }
    setSaving(false);
    if (!outcome.ok) {
      setMessage(outcome.message);
      return;
    }
    setDraft(draftFrom(outcome.items));
    setShowErrors(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div data-slot="item-editor" className="flex flex-col gap-4">
      {saved && (
        <StatusBanner
          tone="success"
          title="Cambios guardados"
          description="Tus próximos repasos ya usan esta versión."
        />
      )}

      <ol ref={list} className="flex flex-col gap-3">
        {draft.map((entry, index) => {
          const number = index + 1;
          const name = `${itemLabel} ${number}`;
          const fieldErrors = showErrors ? (errors.get(entry.key) ?? {}) : {};
          const state = entry.deleted
            ? "deleted"
            : entry.id === null
              ? "new"
              : isEdited(entry)
                ? "edited"
                : "stored";
          return (
            <li
              key={entry.key}
              data-testid="item-editor-entry"
              data-entry-key={entry.key}
              data-state={state}
            >
              <Card
                padding="md"
                className={cn(
                  "flex flex-col gap-4 transition-colors duration-150",
                  state === "deleted" && "border-dashed bg-neutral-50 py-3",
                  (state === "new" || state === "edited") &&
                    "border-(--theme-soft-edge)",
                )}
              >
                <div className="flex items-center gap-2">
                  <h3
                    className={cn(
                      "font-semibold text-[13px] text-fg",
                      state === "deleted" && "text-fg-muted line-through",
                    )}
                  >
                    {name}
                  </h3>
                  {state === "new" && (
                    <Pill className="bg-(--theme-soft) text-(--theme-soft-fg)">
                      Nueva
                    </Pill>
                  )}
                  {state === "edited" && <Pill tone="neutral">Editada</Pill>}
                  {state === "deleted" ? (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[12.5px] text-fg-muted">
                        Se eliminará al guardar
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          change(restoreDraftEntry(draft, entry.key))
                        }
                      >
                        <Undo2 aria-hidden="true" />
                        Deshacer
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Eliminar ${name.toLowerCase()}`}
                      title="Eliminar"
                      className="ml-auto size-9 text-fg-muted hover:text-destructive"
                      onClick={() => change(removeDraftEntry(draft, entry.key))}
                    >
                      <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
                    </Button>
                  )}
                </div>
                {!entry.deleted &&
                  renderFields({
                    value: entry.value,
                    onChange: (next) =>
                      change(updateDraftEntry(draft, entry.key, next)),
                    errors: fieldErrors,
                    idPrefix: `entry-${entry.key}`,
                  })}
              </Card>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={add}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-(--theme-dash) border-dashed bg-(--theme-tint) font-medium text-(--theme-ink) text-[13.5px] transition-colors duration-150 hover:bg-(--theme-soft) focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Plus aria-hidden="true" size={16} strokeWidth={2} />
        {addLabel}
      </button>

      {message && <FormMessage>{message}</FormMessage>}

      <div className="sticky bottom-4 z-10">
        <Card
          padding="sm"
          className="flex flex-wrap items-center justify-between gap-3 shadow-card-hover"
        >
          <p
            aria-live="polite"
            className={cn(
              "text-[13px]",
              dirty ? "font-medium text-fg" : "text-fg-muted",
            )}
          >
            {changesLabel(changes)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || saving}
              onClick={discard}
            >
              Descartar cambios
            </Button>
            <Button
              type="button"
              variant="technique"
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </Card>
      </div>

      <UnsavedChangesGuard when={dirty} />
    </div>
  );
}
