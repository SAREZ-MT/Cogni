"use client";

import Link from "next/link";
import { useId } from "react";
import { NativeSelect } from "@/shared/ui/native-select";

export interface PagePickerNotebook {
  id: string;
  title: string;
  // The notebook's active pages, in notebook order.
  pages: readonly { id: string; title: string }[];
}

export interface PagePickerProps {
  // null when the notebooks could not be read (a load error, never the
  // "no notebooks yet" state).
  notebooks: readonly PagePickerNotebook[] | null;
  notebookId: string;
  // "" until a page is chosen.
  pageId: string;
  onNotebookChange: (notebookId: string) => void;
  onPageChange: (pageId: string) => void;
  disabled?: boolean;
  // Tags the selects as `${testIdPrefix}-notebook` / `-page`.
  testIdPrefix: string;
}

const LOAD_FAILURE = "No pudimos cargar tus cuadernos. Intenta de nuevo.";

const LINK =
  "font-semibold text-primary-700 underline-offset-2 hover:underline focus-visible:underline";

// The "which page?" step of every create dialog that starts from a
// technique hub (Phase 8 H11; first in "Crear examen", Phase 6 T5b): all
// study content belongs to a page, so the student picks a notebook, then
// one of its pages. Native selects (keyboard, screen readers and mobile
// pickers for free). Never a dead end: without notebooks it links to
// /notebooks ("Crear un cuaderno"), and a notebook without pages links to
// that notebook ("Crear una página"); a failed read is a load error.
export function PagePicker({
  notebooks,
  notebookId,
  pageId,
  onNotebookChange,
  onPageChange,
  disabled = false,
  testIdPrefix,
}: PagePickerProps) {
  const notebookFieldId = useId();
  const pageFieldId = useId();

  if (notebooks === null) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {LOAD_FAILURE}
      </p>
    );
  }
  if (notebooks.length === 0) {
    return (
      <p className="text-fg-muted text-sm">
        <span>Aún no tienes cuadernos. Crea uno para empezar.</span>{" "}
        <Link href="/notebooks" className={LINK}>
          Crear un cuaderno
        </Link>
      </p>
    );
  }

  const notebook = notebooks.find((n) => n.id === notebookId);
  const pages = notebook?.pages ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={notebookFieldId} className="text-fg-secondary text-sm">
          Cuaderno
        </label>
        <NativeSelect
          id={notebookFieldId}
          value={notebookId}
          onChange={(event) => onNotebookChange(event.target.value)}
          disabled={disabled}
          data-testid={`${testIdPrefix}-notebook`}
        >
          {notebooks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      {pages.length === 0 ? (
        <p className="text-fg-muted text-sm">
          <span>Este cuaderno aún no tiene páginas.</span>{" "}
          <Link href={`/notebooks/${notebookId}`} className={LINK}>
            Crear una página
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={pageFieldId} className="text-fg-secondary text-sm">
            Página
          </label>
          <NativeSelect
            id={pageFieldId}
            value={pageId}
            onChange={(event) => onPageChange(event.target.value)}
            disabled={disabled}
            required
            data-testid={`${testIdPrefix}-page`}
          >
            <option value="" disabled>
              Elige una página
            </option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
}
