import { COLOR_PALETTE, type NotebookColor } from "@/modules/notebooks";
import type { DueKind, DueTodayPageView } from "@/modules/scheduling";
import type { TechniqueTone } from "@/shared/ui/technique-card";

// One technique of one page with items due now: a TechniqueChip on "Hoy".
export interface TodayChip {
  kind: DueKind;
  tone: TechniqueTone;
  label: string;
  count: number;
  href: string;
  ariaLabel: string;
}

// One technique of one page with items due now: a "Para repasar hoy" row
// on Home, whose button opens that technique's session directly.
export interface ReviewRow {
  key: string;
  kind: DueKind;
  tone: TechniqueTone;
  techniqueLabel: string;
  count: number;
  pageTitle: string;
  notebookTitle: string;
  notebookTone: NotebookColor;
  href: string;
  ariaLabel: string;
}

export interface TodayRow {
  pageId: string;
  pageTitle: string;
  notebookTitle: string;
  notebookTone: NotebookColor;
  totalDue: number;
  chips: TodayChip[];
}

// Same order, names and colours as the page's techniques panel (Phase 6
// T5b: Flashcards yellow, Recordación activa green, Examen rose); each
// opens that technique's session for the page — flashcards straight into
// the graded review of its due cards (`?repasar=1`).
export const TECHNIQUES: readonly {
  kind: DueKind;
  tone: TechniqueTone;
  label: string;
  href: (notebookId: string, pageId: string) => string;
}[] = [
  {
    kind: "flashcard",
    tone: "yellow",
    label: "Flashcards",
    href: (notebookId, pageId) =>
      `/flashcards/${notebookId}/${pageId}?repasar=1`,
  },
  {
    kind: "recall_question",
    tone: "green",
    label: "Recordación activa",
    href: (notebookId, pageId) => `/active-recall/${notebookId}/${pageId}`,
  },
  {
    kind: "exam_question",
    tone: "rose",
    label: "Examen",
    href: (notebookId, pageId) => `/exams/${notebookId}/${pageId}`,
  },
];

const DEFAULT_TONE: NotebookColor = "purple";

// A stored notebook colour as a NotebookColor (violet when unknown).
export function toTone(color: string | null): NotebookColor {
  return COLOR_PALETTE.find((candidate) => candidate === color) ?? DEFAULT_TONE;
}

function pendientes(count: number): string {
  return `${count} ${count === 1 ? "pendiente" : "pendientes"}`;
}

// "Hoy" rows (documento-maestro §3.5): scheduling's due pages, already in
// "waited longest first" order, each with one chip per technique due.
export function toTodayRows(pages: readonly DueTodayPageView[]): TodayRow[] {
  return pages.map((page) => {
    const chips = TECHNIQUES.filter(({ kind }) => page.due[kind] > 0).map(
      ({ kind, tone, label, href }) => ({
        kind,
        tone,
        label,
        count: page.due[kind],
        href: href(page.notebookId, page.pageId),
        ariaLabel: `${label} de ${page.pageTitle}: ${pendientes(page.due[kind])}`,
      }),
    );
    return {
      pageId: page.pageId,
      pageTitle: page.pageTitle,
      notebookTitle: page.notebookTitle,
      notebookTone: toTone(page.notebookColor),
      totalDue: chips.reduce((sum, chip) => sum + chip.count, 0),
      chips,
    };
  });
}

// Home's "Para repasar hoy" (Phase 8 H2-T5d): the same due pages, already
// in "waited longest first" order, split into one row per technique due,
// in the techniques panel order within a page.
export function toReviewRows(pages: readonly DueTodayPageView[]): ReviewRow[] {
  return pages.flatMap((page) =>
    TECHNIQUES.filter(({ kind }) => page.due[kind] > 0).map(
      ({ kind, tone, label, href }) => ({
        key: `${page.pageId}:${kind}`,
        kind,
        tone,
        techniqueLabel: label,
        count: page.due[kind],
        pageTitle: page.pageTitle,
        notebookTitle: page.notebookTitle,
        notebookTone: toTone(page.notebookColor),
        href: href(page.notebookId, page.pageId),
        ariaLabel: `Repasar ${label} de ${page.pageTitle}: ${pendientes(page.due[kind])}`,
      }),
    ),
  );
}
