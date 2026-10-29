import type { NotebookCoverTone } from "@/shared/ui/notebook-cover-card";

// A notebook's colour as a small dot (Phase 8 H17: the technique hubs'
// notebook labels and filter chips): the 400 stop of the notebook cover's
// gradient (`NotebookCoverCard`), so the dot reads as that notebook
// everywhere. Violet is the fallback for a notebook without a colour.
export const NOTEBOOK_DOT: Record<NotebookCoverTone, string> = {
  pink: "bg-pink-400",
  green: "bg-emerald-400",
  yellow: "bg-amber-400",
  purple: "bg-primary-500",
  orange: "bg-orange-400",
  blue: "bg-blue-400",
  mint: "bg-teal-400",
};

// A stored notebook colour as a palette tone; unknown or missing colours
// are violet, so a stale value can never break a lookup.
export function toNotebookTone(
  value: string | null | undefined,
): NotebookCoverTone {
  return value != null && Object.hasOwn(NOTEBOOK_DOT, value)
    ? (value as NotebookCoverTone)
    : "purple";
}

export function notebookDotClass(value: string | null | undefined): string {
  return NOTEBOOK_DOT[toNotebookTone(value)];
}
