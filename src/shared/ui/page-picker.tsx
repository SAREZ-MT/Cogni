"use client";

import Link from "next/link";
import { useId } from "react";
import { MIN_GENERATION_WORDS } from "@/shared/kernel/generation-capacity";
import { FieldLabel } from "@/shared/ui/field-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { shortPageHint } from "@/shared/ui/short-page-copy";

export interface PagePickerNotebook {
  id: string;
  title: string;
  // The notebook's active pages, in notebook order. `words` (Phase 8 H14)
  // is the page's word count; unknown pages stay selectable.
  pages: readonly { id: string; title: string; words?: number }[];
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
  // Phase 8 H14 (user 2026-10-29): pages under these words are disabled
  // with the reason (100 by default; 150 for recall and exams, whose ten
  // questions need about 15 words each).
  minWords?: number;
}

const LOAD_FAILURE = "No pudimos cargar tus cuadernos. Intenta de nuevo.";

const LINK =
  "font-semibold text-primary-700 underline-offset-2 hover:underline focus-visible:underline";

// The "which page?" step of every create dialog that starts from a
// technique hub (Phase 8 H11; first in "Crear examen", Phase 6 T5b): all
// study content belongs to a page, so the student picks a notebook, then
// one of its pages, with the styled `Select` atom (Phase 8 H12; Radix
// gives the keyboard and screen-reader support). Never a dead end: without notebooks it links to
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
  minWords = MIN_GENERATION_WORDS,
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
      <p className="rounded-xl bg-neutral-50 px-3.5 py-3 text-fg-muted text-sm">
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={notebookFieldId}>Cuaderno</FieldLabel>
        <Select
          value={notebookId}
          onValueChange={onNotebookChange}
          disabled={disabled}
        >
          <SelectTrigger
            id={notebookFieldId}
            data-testid={`${testIdPrefix}-notebook`}
          >
            <SelectValue placeholder="Elige un cuaderno" />
          </SelectTrigger>
          <SelectContent>
            {notebooks.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {pages.length === 0 ? (
        <p className="rounded-xl bg-neutral-50 px-3.5 py-3 text-fg-muted text-sm">
          <span>Este cuaderno aún no tiene páginas.</span>{" "}
          <Link href={`/notebooks/${notebookId}`} className={LINK}>
            Crear una página
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={pageFieldId}>Página</FieldLabel>
          <Select
            value={pageId}
            onValueChange={onPageChange}
            disabled={disabled}
            required
          >
            <SelectTrigger
              id={pageFieldId}
              data-testid={`${testIdPrefix}-page`}
            >
              <SelectValue placeholder="Elige una página" />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => {
                const short = p.words !== undefined && p.words < minWords;
                return (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    disabled={short}
                    hint={
                      short && p.words !== undefined
                        ? shortPageHint(p.words, minWords)
                        : undefined
                    }
                  >
                    {p.title}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
